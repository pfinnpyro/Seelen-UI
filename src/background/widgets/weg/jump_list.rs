use std::{
    io::{Cursor, Read},
    path::{Path, PathBuf},
};

use seelen_core::system_state::{JumpListItem, JumpListSection};
use windows::{
    core::PCWSTR,
    Win32::{
        System::Com::IPersistStream,
        UI::Shell::{
            Common::IObjectArray, ApplicationDocumentLists, IApplicationDocumentLists, IShellItem,
            IShellLinkW, SHCreateMemStream, ShellLink, ADLT_RECENT, SIGDN_FILESYSPATH,
            SIGDN_NORMALDISPLAY,
        },
    },
};

use crate::{
    error::{Result, ResultLogExt},
    windows_api::{string_utils::WindowsString, Com, WindowsApi},
};

/// Jones/Ecma CRC-64 polynomial used by Windows for jump list filename hashes.
const CRC64_JONES_POLY: u64 = 0xad93d23594c935a9;

/// Compute the Jones CRC-64 of a byte slice.
fn crc64_jones(data: &[u8]) -> u64 {
    let mut crc: u64 = 0;
    for &byte in data {
        let mut b = byte;
        for _ in 0..8 {
            if (crc ^ b as u64) & 1 != 0 {
                crc = (crc >> 1) ^ CRC64_JONES_POLY;
            } else {
                crc >>= 1;
            }
            b >>= 1;
        }
    }
    crc
}

/// Compute the 16-hex-char filename prefix for a jump list file from an AppUserModelID.
fn get_jump_list_hash(umid: &str) -> String {
    let lower = umid.to_lowercase();
    let utf16_bytes: Vec<u8> = lower.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    format!("{:016x}", crc64_jones(&utf16_bytes))
}

/// Get the path to the `.customDestinations-ms` file for a given UMID, if it exists.
fn get_custom_destinations_path(umid: &str) -> Option<PathBuf> {
    let appdata = std::env::var("APPDATA").ok()?;
    let hash = get_jump_list_hash(umid);
    let path = PathBuf::from(appdata)
        .join("Microsoft")
        .join("Windows")
        .join("Recent")
        .join("CustomDestinations")
        .join(format!("{}.customDestinations-ms", hash));
    path.exists().then_some(path)
}

// ========================
// Custom destinations parser
// ========================

fn read_u16_le(cursor: &mut Cursor<&[u8]>) -> Result<u16> {
    let mut buf = [0u8; 2];
    cursor.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(u16::from_le_bytes(buf))
}

fn read_u32_le(cursor: &mut Cursor<&[u8]>) -> Result<u32> {
    let mut buf = [0u8; 4];
    cursor.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(u32::from_le_bytes(buf))
}

fn read_utf16_le(cursor: &mut Cursor<&[u8]>, char_count: usize) -> Result<String> {
    let byte_count = char_count * 2;
    let mut buf = vec![0u8; byte_count];
    cursor.read_exact(&mut buf).map_err(|e| e.to_string())?;
    let utf16: Vec<u16> = buf
        .chunks_exact(2)
        .map(|c| u16::from_le_bytes([c[0], c[1]]))
        .collect();
    String::from_utf16(&utf16).map_err(|e| e.to_string().into())
}

/// Deserialize a shell link from raw bytes and extract jump list item fields.
fn shell_link_from_bytes(data: &[u8]) -> Result<JumpListItem> {
    Com::run_with_context(|| {
        let stream = unsafe { SHCreateMemStream(Some(data)) }
            .ok_or("Failed to create IStream from shell link bytes")?;

        let shell_link: IShellLinkW = Com::create_instance(&ShellLink)?;
        let persist: IPersistStream = shell_link.cast()?;
        unsafe { persist.Load(&stream)? };

        // Description is the displayed task name for jump list tasks.
        let mut description = WindowsString::new_to_fill(1024);
        let _ = unsafe { shell_link.GetDescription(description.as_mut_slice()) };

        let mut target_path = WindowsString::new_to_fill(1024);
        let mut find_data = windows::Win32::Storage::FileSystem::WIN32_FIND_DATAW::default();
        let _ = unsafe { shell_link.GetPath(target_path.as_mut_slice(), &mut find_data, 0) };

        let mut arguments = WindowsString::new_to_fill(4096);
        let _ = unsafe { shell_link.GetArguments(arguments.as_mut_slice()) };

        let mut working_dir = WindowsString::new_to_fill(1024);
        let _ = unsafe { shell_link.GetWorkingDirectory(working_dir.as_mut_slice()) };

        let mut icon_path_buf = WindowsString::new_to_fill(1024);
        let mut icon_idx = 0i32;
        let _ = unsafe { shell_link.GetIconLocation(icon_path_buf.as_mut_slice(), &mut icon_idx) };

        // Prefer the description as the title; fall back to the executable filename.
        let title = if !description.is_empty() {
            description.to_string()
        } else if !target_path.is_empty() {
            PathBuf::from(target_path.to_os_string())
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        } else {
            return Err("Could not determine link title".into());
        };

        let resolve = |ws: WindowsString| -> Option<PathBuf> {
            if ws.is_empty() {
                return None;
            }
            let resolved = WindowsApi::resolve_environment_variables(&ws).unwrap_or(ws);
            Some(resolved.to_os_string().into())
        };

        Ok(JumpListItem {
            title,
            path: resolve(target_path),
            args: if arguments.is_empty() {
                None
            } else {
                Some(arguments.to_string())
            },
            working_dir: resolve(working_dir),
            icon_path: resolve(icon_path_buf),
            icon_index: icon_idx,
        })
    })
}

/// Parse the items within a single section of a `.customDestinations-ms` file.
fn parse_section_items(cursor: &mut Cursor<&[u8]>, num_items: u32) -> Vec<JumpListItem> {
    let mut items = Vec::new();
    for _ in 0..num_items {
        let item_type = match read_u32_le(cursor) {
            Ok(t) => t,
            Err(_) => break,
        };
        match item_type {
            0 => {
                // SHELL_LINK item
                let data_size = match read_u32_le(cursor) {
                    Ok(s) => s as usize,
                    Err(_) => break,
                };
                let mut data = vec![0u8; data_size];
                if cursor.read_exact(&mut data).is_err() {
                    break;
                }
                if let Ok(item) = shell_link_from_bytes(&data) {
                    items.push(item);
                }
            }
            1 => {} // SEPARATOR – section boundaries already provide visual separation
            _ => break, // Unknown type; stop parsing this section
        }
    }
    items
}

/// Parse all sections from the raw bytes of a `.customDestinations-ms` file.
///
/// Format (undocumented, reverse-engineered):
///   DWORD num_sections
///   for each section:
///     DWORD type  (0=FREQUENT, 1=RECENT, 2=CUSTOM_CATEGORY, 3=USER_TASKS)
///     [if type == 2] WORD title_char_count; WCHAR[n] title
///     [if type == 2 or 3]
///       DWORD num_items
///       for each item:
///         DWORD item_type (0=SHELL_LINK, 1=SEPARATOR)
///         [if item_type == 0] DWORD link_size; BYTE[link_size] link_data
///   DWORD 0xBABFFBAB  (end marker)
fn parse_custom_destinations(data: &[u8]) -> Vec<JumpListSection> {
    let mut cursor = Cursor::new(data);
    let mut sections = Vec::new();

    let num_sections = match read_u32_le(&mut cursor) {
        Ok(n) if n < 100 => n,
        _ => return sections,
    };

    for _ in 0..num_sections {
        let section_type = match read_u32_le(&mut cursor) {
            Ok(t) => t,
            Err(_) => break,
        };

        match section_type {
            0 | 1 => {
                // Known categories (FREQUENT / RECENT) – items are not stored in the file;
                // they are retrieved separately via IApplicationDocumentLists.
            }
            2 => {
                // Custom category with a user-defined title.
                let name_char_count = match read_u16_le(&mut cursor) {
                    Ok(n) => n as usize,
                    Err(_) => break,
                };
                let name = match read_utf16_le(&mut cursor, name_char_count) {
                    Ok(n) => n,
                    Err(_) => break,
                };
                let num_items = match read_u32_le(&mut cursor) {
                    Ok(n) if n < 1000 => n,
                    _ => break,
                };
                let items = parse_section_items(&mut cursor, num_items);
                if !items.is_empty() {
                    sections.push(JumpListSection {
                        name: Some(name),
                        items,
                    });
                }
            }
            3 => {
                // User-defined tasks (unnamed category).
                let num_items = match read_u32_le(&mut cursor) {
                    Ok(n) if n < 1000 => n,
                    _ => break,
                };
                let items = parse_section_items(&mut cursor, num_items);
                if !items.is_empty() {
                    sections.push(JumpListSection { name: None, items });
                }
            }
            _ => break, // Unknown section type; stop.
        }
    }

    sections
}

// ========================
// IApplicationDocumentLists
// ========================

/// Fetch the recent document items for an application using IApplicationDocumentLists.
fn get_recent_items(umid: &str) -> Vec<JumpListItem> {
    let result: Result<Vec<JumpListItem>> = Com::run_with_context(|| {
        let doc_list: IApplicationDocumentLists =
            Com::create_instance(&ApplicationDocumentLists)?;
        let umid_wide: Vec<u16> = umid.encode_utf16().chain(Some(0)).collect();
        unsafe { doc_list.SetAppID(PCWSTR(umid_wide.as_ptr()))? };

        let obj_array: IObjectArray =
            unsafe { doc_list.GetList(ADLT_RECENT, 10)? };

        let count = unsafe { obj_array.GetCount()? };
        let mut items = Vec::new();

        for i in 0..count {
            // Recent doc items are IShellItem objects (file paths).
            if let Ok(shell_item) = unsafe { obj_array.GetAt::<IShellItem>(i) } {
                let display_name = unsafe { shell_item.GetDisplayName(SIGDN_NORMALDISPLAY) }
                    .ok()
                    .and_then(|n| n.to_string().ok())
                    .unwrap_or_default();

                let file_path = unsafe { shell_item.GetDisplayName(SIGDN_FILESYSPATH) }
                    .ok()
                    .and_then(|p| p.to_string().ok())
                    .map(PathBuf::from);

                if !display_name.is_empty() {
                    items.push(JumpListItem {
                        title: display_name,
                        path: file_path,
                        args: None,
                        working_dir: None,
                        icon_path: None,
                        icon_index: 0,
                    });
                }
            }
        }

        Ok(items)
    });

    result.log_error().unwrap_or_default()
}

// ========================
// Public API
// ========================

/// Retrieve the Windows Jump List sections for an application.
///
/// Returns tasks, custom categories, and recent documents from Windows'
/// jump list subsystem, suitable for display in the dock context menu.
pub fn get_jump_list(umid: Option<&str>, _path: Option<&Path>) -> Result<Vec<JumpListSection>> {
    let mut sections: Vec<JumpListSection> = Vec::new();

    if let Some(umid) = umid {
        // 1. Tasks and custom categories from the CustomDestinations file.
        if let Some(custom_path) = get_custom_destinations_path(umid) {
            if let Ok(data) = std::fs::read(&custom_path) {
                sections.extend(parse_custom_destinations(&data));
            }
        }

        // 2. Recent documents from IApplicationDocumentLists.
        let recent = get_recent_items(umid);
        if !recent.is_empty() {
            sections.push(JumpListSection {
                name: Some("Recent".to_string()),
                items: recent,
            });
        }
    }

    Ok(sections)
}
