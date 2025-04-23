import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

type AppMode = "apps" | "clipboard" | "create_quick_link" | "add_manual_app";

const WINDOW_SIZES = {
  apps: { width: 750, height: 500 },
  clipboard: { width: 900, height: 700 },
  create_quick_link: { width: 750, height: 600 },
  add_manual_app: { width: 750, height: 500 },
};

export function useAppNavigation() {
  const [mode, setMode] = useState<AppMode>("apps");

  const resizeWindowForMode = (mode: AppMode) => {
    const size = WINDOW_SIZES[mode];
    invoke("resize_window", { width: size.width, height: size.height });
  };

  const handleBackToApps = () => {
    setMode("apps");
    resizeWindowForMode("apps");
  };

  const handleEscape = () => {
    if (mode === "create_quick_link" || mode === "add_manual_app") {
      setMode("apps");
      resizeWindowForMode("apps");
      return true;
    }

    if (mode === "clipboard") {
      setMode("apps");
      resizeWindowForMode("apps");
      return true;
    }

    invoke("hide_window");
    return false;
  };

  return {
    mode,
    setMode,
    resizeWindowForMode,
    handleBackToApps,
    handleEscape,
  };
}