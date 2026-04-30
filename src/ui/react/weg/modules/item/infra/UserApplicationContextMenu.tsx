import { invoke, SeelenCommand, Widget } from "@seelen-ui/lib";
import type { ContextMenu, ContextMenuItem, UserAppWindow } from "@seelen-ui/lib/types";
import type { JumpListItem, JumpListSection } from "@seelen-ui/lib/types";
import type { TFunction } from "i18next";

import type { AppOrFileWegItem } from "../../shared/types.ts";

import { $dock_state_actions } from "../../shared/state/items.ts";
import { $full_settings, $settings } from "../../shared/state/settings.ts";

const identifier = crypto.randomUUID();
const onAppMenuClick = "weg::app_menu_click";
const onJumpListItemClick = "weg::jump_list_item_click";

let pendingAppItem: AppOrFileWegItem | null = null;
let pendingAppWindows: UserAppWindow[] = [];

Widget.self.webview.listen(onAppMenuClick, ({ payload }) => {
  const { key } = payload as { key: string };
  const item = pendingAppItem;
  const windows = pendingAppWindows;
  if (!item) return;

  if (key === "unpin") {
    if (windows.length) {
      $dock_state_actions.unpinApp(item.id);
    } else {
      $dock_state_actions.remove(item.id);
    }
  } else if (key === "pin") {
    $dock_state_actions.pinApp(item.id);
  } else if (key === "run") {
    launchItem(item, false);
  } else if (key === "open_location") {
    invoke(SeelenCommand.SelectFileOnExplorer, { path: item.path });
  } else if (key === "run_as") {
    launchItem(item, true);
  } else if (key === "copy_hwnd") {
    navigator.clipboard.writeText(JSON.stringify(windows.map((w) => w.hwnd.toString(16))));
  } else if (key === "close") {
    windows.forEach((w) => {
      invoke(SeelenCommand.WegCloseApp, { hwnd: w.hwnd });
    });
  } else if (key === "kill") {
    windows.forEach((w) => {
      invoke(SeelenCommand.WegKillApp, { hwnd: w.hwnd });
    });
  }
});

Widget.self.webview.listen(onJumpListItemClick, ({ payload }) => {
  const { value } = payload as { value: JumpListItem | null };
  if (!value?.path) return;
  invoke(SeelenCommand.Run, {
    program: value.path,
    args: value.args,
    workingDir: value.workingDir,
    elevated: false,
  });
});

function jumpListSectionsToMenuItems(sections: JumpListSection[]): ContextMenuItem[] {
  if (!sections.length) return [];

  const menuItems: ContextMenuItem[] = [];

  for (const section of sections) {
    const sectionItems: ContextMenuItem[] = section.items.map((jItem, index) => ({
      type: "Item" as const,
      key: `jump_list_item_${index}`,
      label: jItem.title,
      callbackEvent: onJumpListItemClick,
      value: jItem,
    }));

    if (!sectionItems.length) continue;

    if (section.name) {
      // Named sections (e.g. "Recent") become submenus.
      menuItems.push({
        type: "Submenu",
        identifier: crypto.randomUUID(),
        label: section.name,
        items: sectionItems,
      });
    } else {
      // The unnamed Tasks section: items appear inline.
      menuItems.push(...sectionItems);
    }
  }

  return menuItems;
}

export async function getUserApplicationContextMenu(
  t: TFunction,
  item: AppOrFileWegItem,
  windows: UserAppWindow[],
): Promise<ContextMenu> {
  pendingAppItem = item;
  pendingAppWindows = windows;

  const items: ContextMenuItem[] = [];

  // Prepend jump list sections (tasks + recent items) if available.
  const jumpListSections = await invoke(SeelenCommand.WegGetJumpList, {
    umid: item.umid,
    path: item.path,
  }).catch((err: unknown) => {
    console.error("WegGetJumpList failed:", err);
    return [] as JumpListSection[];
  });

  const jumpListItems = jumpListSectionsToMenuItems(jumpListSections);
  if (jumpListItems.length) {
    items.push(...jumpListItems);
    items.push({ type: "Separator" });
  }

  if (!item.preventPinning) {
    if (item.pinned) {
      items.push({
        type: "Item",
        key: "unpin",
        icon: "RiUnpinLine",
        label: t("app_menu.unpin"),
        callbackEvent: onAppMenuClick,
      });
    } else {
      items.push({
        type: "Item",
        key: "pin",
        icon: "RiPushpinLine",
        label: t("app_menu.pin"),
        callbackEvent: onAppMenuClick,
      });
    }
    items.push({ type: "Separator" });
  }

  items.push(
    {
      type: "Item",
      key: "run",
      icon: "IoOpenOutline",
      label: item.displayName,
      callbackEvent: onAppMenuClick,
    },
    {
      type: "Item",
      key: "open_location",
      icon: "MdOutlineMyLocation",
      label: t("app_menu.open_file_location"),
      callbackEvent: onAppMenuClick,
    },
    {
      type: "Item",
      key: "run_as",
      icon: "MdOutlineAdminPanelSettings",
      label: t("app_menu.run_as"),
      callbackEvent: onAppMenuClick,
    },
  );

  if (windows.length) {
    if ($full_settings.value.devTools) {
      items.push({
        type: "Item",
        key: "copy_hwnd",
        icon: "AiOutlineCopy",
        label: t("app_menu.copy_handles"),
        callbackEvent: onAppMenuClick,
      });
    }

    items.push({
      type: "Item",
      key: "close",
      icon: "BiWindowClose",
      label: windows.length > 1 ? t("app_menu.close_multiple") : t("app_menu.close"),
      callbackEvent: onAppMenuClick,
    });

    if ($settings.value.showEndTask) {
      items.push({
        type: "Item",
        key: "kill",
        icon: "MdOutlineDangerous",
        label: windows.length > 1 ? t("app_menu.kill_multiple") : t("app_menu.kill"),
        callbackEvent: onAppMenuClick,
      });
    }
  }

  return { identifier, items };
}

export function launchItem(item: AppOrFileWegItem, elevated: boolean) {
  if (item.relaunch) {
    return invoke(SeelenCommand.Run, {
      program: item.relaunch.command,
      args: item.relaunch.args,
      workingDir: item.relaunch.workingDir,
      elevated,
    });
  }

  return invoke(SeelenCommand.Run, {
    program: item.umid ? `shell:AppsFolder\\${item.umid}` : item.path,
    args: null,
    workingDir: null,
    elevated,
  });
}
