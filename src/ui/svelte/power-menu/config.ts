/**
 * Shared power-menu type definitions and config reader.
 *
 * These types mirror the Rust enums in `libs/core/src/state/settings/mod.rs`.
 * Once `deno task build:rs` is run they will be generated automatically; until
 * then the casts in this file are the single place where `any` is used.
 */

/** Mirror of the Rust `PowerMenuLayout` enum. */
export type PowerMenuLayout = "Fullscreen" | "FlyoutList" | "FlyoutGrid";

/** Mirror of the Rust `PowerMenuAction` enum. */
export type PowerMenuAction = "Lock" | "LogOut" | "Shutdown" | "Restart" | "Suspend" | "Hibernate";

export interface PowerMenuSettings {
  layout: PowerMenuLayout;
  items: PowerMenuAction[];
}

export const DEFAULT_POWER_MENU_SETTINGS: PowerMenuSettings = {
  layout: "Fullscreen",
  items: ["Lock", "LogOut", "Shutdown", "Restart", "Suspend", "Hibernate"],
};

/**
 * Reads the power menu settings from a raw `Settings.byWidget` map.
 * The type cast is intentional: the generated TS bindings don't yet include
 * `@seelen/power-menu` as a named key. This is the single point to update
 * once `deno task build:rs` regenerates the types.
 */
export function parsePowerMenuSettings(byWidget: unknown): PowerMenuSettings {
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
