import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export function useQuickLinks(setQuery?: (query: string) => void) {
  const [quickLinkQueryData, setQuickLinkQueryData] = useState<{
    id: string;
    name: string;
    command: string;
  } | null>(null);

  const executeQuickLinkWithQuery = async (finalCommand: string) => {
    if (!quickLinkQueryData) return;

    await invoke("execute_quick_link_with_command", {
      quickLinkId: quickLinkQueryData.id,
      command: finalCommand,
    });

    setQuickLinkQueryData(null);

    // Clear query if setQuery function is provided
    if (setQuery) {
      setQuery("");
      const commandInput = document.getElementById("command-input");
      if (commandInput) {
        (commandInput as HTMLInputElement).focus();
      }
    }

    // Forcefully clear the input element
    const inputElement = document.getElementById("command-input");
    if (inputElement) {
      (inputElement as HTMLInputElement).value = "";
    }

    await invoke("hide_window");
  };

  return {
    quickLinkQueryData,
    setQuickLinkQueryData,
    executeQuickLinkWithQuery,
  };
}
