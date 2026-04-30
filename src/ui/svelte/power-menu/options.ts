import { invoke } from "@tauri-apps/api/core";
import { SeelenCommand } from "@seelen-ui/lib";
import type { PowerMenuAction } from "./state.svelte.ts";

interface Option {
  key: string;
  icon: string;
  onClick: () => void;
}

const ALL_OPTIONS: Record<PowerMenuAction, Option> = {
  Lock: {
    key: "lock",
    icon: "IoLockClosed",
    onClick() {
      invoke(SeelenCommand.Lock);
    },
  },
  LogOut: {
    key: "log_out",
    icon: "IoLogOutOutline",
    onClick() {
      invoke(SeelenCommand.LogOut);
    },
  },
  Shutdown: {
    key: "shutdown",
    icon: "IoPower",
    onClick() {
      invoke(SeelenCommand.Shutdown);
    },
  },
  Restart: {
    key: "reboot",
    icon: "MdRestartAlt",
    onClick() {
      invoke(SeelenCommand.Restart);
    },
  },
  Suspend: {
    key: "suspend",
    icon: "BiMoon",
    onClick() {
      invoke(SeelenCommand.Suspend);
    },
  },
  Hibernate: {
    key: "hibernate",
    icon: "TbZzz",
    onClick() {
      invoke(SeelenCommand.Hibernate);
    },
  },
};

/** Returns the ordered list of visible options based on user configuration. */
export function getOptions(items: PowerMenuAction[]): Option[] {
  return items.map((action) => ALL_OPTIONS[action]).filter(Boolean);
}
