use std::path::PathBuf;

/// A single item in a Windows Jump List
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "gen-binds", ts(export))]
pub struct JumpListItem {
    /// Display title of the item
    pub title: String,
    /// Executable path (may be None for UWP/packaged apps)
    pub path: Option<PathBuf>,
    /// Command-line arguments
    pub args: Option<String>,
    /// Working directory
    pub working_dir: Option<PathBuf>,
    /// Icon file path
    pub icon_path: Option<PathBuf>,
    /// Icon index within the icon file
    pub icon_index: i32,
}

/// A grouping of jump list items, corresponding to a Windows Jump List category
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "gen-binds", ts(export))]
pub struct JumpListSection {
    /// Category name; `None` for the unnamed Tasks category
    pub name: Option<String>,
    /// Items in this section
    pub items: Vec<JumpListItem>,
}
