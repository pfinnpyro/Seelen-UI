import { Icon } from "libs/ui/react/components/Icon/index.tsx";
import { Select } from "antd";
import { useTranslation } from "react-i18next";

import { SettingsGroup, SettingsOption, SettingsSubGroup } from "../../components/SettingsBox/index.tsx";
import { VerticalSortableSelect } from "../../components/SortableSelector/index.tsx";
import {
  ALL_POWER_MENU_ACTIONS,
  getPowerMenuConfig,
  setPowerMenuItems,
  setPowerMenuLayout,
  type PowerMenuAction,
  type PowerMenuLayout,
} from "./application.ts";

const LAYOUT_OPTIONS: { value: PowerMenuLayout; label: string }[] = [
  { value: "Fullscreen", label: "Fullscreen" },
  { value: "FlyoutList", label: "Flyout – List" },
  { value: "FlyoutGrid", label: "Flyout – Grid" },
];

const ICON_FOR_ACTION: Record<PowerMenuAction, string> = {
  Lock: "IoLockClosed",
  LogOut: "IoLogOutOutline",
  Shutdown: "IoPower",
  Restart: "MdRestartAlt",
  Suspend: "BiMoon",
  Hibernate: "TbZzz",
};

export function PowerMenuSettings() {
  const config = getPowerMenuConfig();
  const { t } = useTranslation();

  const actionOptions = ALL_POWER_MENU_ACTIONS.map((action) => ({
    value: action,
    label: (
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon iconName={ICON_FOR_ACTION[action] as any} size={16} />
        {t(`power_menu.actions.${action.toLowerCase()}`)}
      </span>
    ),
  }));

  return (
    <>
      <SettingsGroup>
        <SettingsOption
          label={t("power_menu.layout")}
          action={
            <Select
              style={{ width: "160px" }}
              value={config.layout}
              options={LAYOUT_OPTIONS}
              onChange={(value) => setPowerMenuLayout(value)}
            />
          }
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsSubGroup label={t("power_menu.items")}>
          <VerticalSortableSelect
            options={actionOptions}
            enabled={config.items}
            onChange={(items) => setPowerMenuItems(items as PowerMenuAction[])}
          />
        </SettingsSubGroup>
      </SettingsGroup>
    </>
  );
}
