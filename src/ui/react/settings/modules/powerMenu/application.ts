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

/**
 * Reads the power menu settings from a raw byWidget map.
 * The cast to `Record<string, unknown>` is intentional: the generated TS bindings don't yet
 * include `@seelen/power-menu` as a named key. This is the single point to update once
 * `deno task build:rs` regenerates the types.
 */
function parsePowerMenuSettings(byWidget: unknown): PowerMenuSettings {
  const raw = (byWidget as Record<string, unknown>)["@seelen/power-menu"];
  if (!raw || typeof raw !== "object") return DEFAULT_POWER_MENU_SETTINGS;
  const r = raw as Record<string, unknown>;
  return {
    layout: (r["layout"] as PowerMenuLayout) ?? DEFAULT_POWER_MENU_SETTINGS.layout,
    items: Array.isArray(r["items"])
      ? (r["items"] as PowerMenuAction[])
      : DEFAULT_POWER_MENU_SETTINGS.items,
  };
}

/** Gets the current PowerMenu configuration from settings. */
export function getPowerMenuConfig(): PowerMenuSettings {
  return parsePowerMenuSettings(settings.value.byWidget);
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
