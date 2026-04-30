import { invoke, type Rect, SeelenCommand, SeelenEvent, Settings, subscribe, Widget } from "@seelen-ui/lib";
import { locale } from "./i18n/index.ts";
import { writable } from "svelte/store";
import { lazyRune } from "libs/ui/svelte/utils/LazyRune.svelte.ts";
import {
  DEFAULT_POWER_MENU_SETTINGS,
  parsePowerMenuSettings,
  type PowerMenuSettings,
} from "./config.ts";

export type { PowerMenuLayout, PowerMenuAction, PowerMenuSettings } from "./config.ts";

let settings = writable(await Settings.getAsync());
Settings.onChange((s) => settings.set(s));
settings.subscribe((settings) => {
  locale.set(settings.language || "en");
});

let powerMenuConfig = $state<PowerMenuSettings>(DEFAULT_POWER_MENU_SETTINGS);
settings.subscribe((s) => {
  powerMenuConfig = parsePowerMenuSettings(s.byWidget);
});

let monitors = lazyRune(() => invoke(SeelenCommand.SystemGetMonitors));
subscribe(SeelenEvent.SystemMonitorsChanged, monitors.setByPayload);

let user = lazyRune(() => invoke(SeelenCommand.GetUser));
subscribe(SeelenEvent.UserChanged, user.setByPayload);

await Promise.all([user.init(), monitors.init()]);

let desktopRect = $derived.by(() => {
  let rect: Rect = { top: 0, left: 0, right: 0, bottom: 0 };
  for (const monitor of monitors.value) {
    rect.left = Math.min(rect.left, monitor.rect.left);
    rect.top = Math.min(rect.top, monitor.rect.top);
    rect.right = Math.max(rect.right, monitor.rect.right);
    rect.bottom = Math.max(rect.bottom, monitor.rect.bottom);
  }
  return rect;
});

$effect.root(() => {
  $effect(() => {
    Widget.self.setPosition(desktopRect);
  });
});

let relativePrimaryMonitor = $derived.by(() => {
  let primary = monitors.value.find((m) => m.isPrimary) || monitors.value[0];
  if (primary) {
    return {
      ...primary,
      rect: {
        top: primary.rect.top - desktopRect.top,
        left: primary.rect.left - desktopRect.left,
        right: primary.rect.right - desktopRect.left,
        bottom: primary.rect.bottom - desktopRect.top,
      },
    };
  }
  return null;
});

export type State = typeof state;
export const state = {
  get primaryMonitor() {
    return relativePrimaryMonitor;
  },
  get user() {
    return user.value;
  },
  get powerMenuConfig() {
    return powerMenuConfig;
  },
};
