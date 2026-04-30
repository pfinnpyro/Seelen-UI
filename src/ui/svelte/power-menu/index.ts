import { getRootContainer } from "libs/ui/react/utils/index.ts";
import { mount } from "svelte";
import App from "./app.svelte";
import { loadTranslations } from "./i18n/index.ts";
import { Settings, Widget } from "@seelen-ui/lib";
import { parsePowerMenuSettings } from "./config.ts";

import "@seelen-ui/lib/styles/reset.css";

await loadTranslations();

const settings = await Settings.getAsync();
const config = parsePowerMenuSettings(settings.byWidget);
const isFlyout = config.layout === "FlyoutList" || config.layout === "FlyoutGrid";

const root = getRootContainer();
const widget = Widget.getCurrent();

widget.onTrigger(async () => {
  await widget.show();
  await widget.focus();
});

if (isFlyout) {
  await widget.init({ autoSizeByContent: root, hideOnFocusLoss: true });
} else {
  await widget.init({ normalizeDevicePixelRatio: true, hideOnFocusLoss: true });
  await widget.window.setResizable(false);
}

mount(App, {
  target: root,
});
