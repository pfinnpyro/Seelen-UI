import { settings } from "../../state/mod";

/** Mirror of the Rust PowerMenuLayout enum. Keep in sync with libs/core/src/state/settings/mod.rs */
export type PowerMenuLayout = "Fullscreen" | "FlyoutList" | "FlyoutGrid";

/** Mirror of the Rust PowerMenuAction enum. Keep in sync with libs/core/src/state/settings/mod.rs */
export type PowerMenuAction = "Lock" | "LogOut" | "Shutdown" | "Restart" | "Suspend" | "Hibernate";

export interface PowerMenuSettings {
  layout: PowerMenuLayout;
  items: PowerMenuAction[];
}

const DEFAULT_POWER_MENU_SETTINGS: PowerMenuSettings = {
  layout: "Fullscreen",
  items: ["Lock", "LogOut", "Shutdown", "Restart", "Suspend", "Hibernate"],
};

export const ALL_POWER_MENU_ACTIONS: PowerMenuAction[] = [
  "Lock",
  "LogOut",
  "Shutdown",
  "Restart",
  "Suspend",
  "Hibernate",
];

/** Gets the current PowerMenu configuration from settings. */
export function getPowerMenuConfig(): PowerMenuSettings {
  const raw = (settings.value.byWidget as any)["@seelen/power-menu"];
  if (!raw) return DEFAULT_POWER_MENU_SETTINGS;
  return {
    layout: (raw.layout as PowerMenuLayout) ?? DEFAULT_POWER_MENU_SETTINGS.layout,
    items: Array.isArray(raw.items)
      ? (raw.items as PowerMenuAction[])
      : DEFAULT_POWER_MENU_SETTINGS.items,
  };
}

/** Patches the PowerMenu configuration. */
export function patchPowerMenuConfig(patch: Partial<PowerMenuSettings>): void {
  const current = getPowerMenuConfig();
  settings.value = {
    ...settings.value,
    byWidget: {
      ...settings.value.byWidget,
      "@seelen/power-menu": {
        ...current,
        ...patch,
      },
    },
  };
}

export function setPowerMenuLayout(layout: PowerMenuLayout): void {
  patchPowerMenuConfig({ layout });
}

export function setPowerMenuItems(items: PowerMenuAction[]): void {
  patchPowerMenuConfig({ items });
}
