import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export interface ClipboardItem {
  id: number;
  text: string;
  pinned: boolean;
  timestamp: number;
}

export const useClipboardHistory = () => {
  const [clipboardHistory, setClipboardHistory] = useState<ClipboardItem[]>([]);
  const [lastClipboardContent, setLastClipboardContent] = useState("");
  const clipboardIntervalRef = useRef<number | null>(null);
  const isInClearing = useRef(false);

  // Dynamic interval management
  const noChangeCountRef = useRef(0);
  const baseInterval = 1000; // Start with 1 second
  const maxInterval = 5000; // Maximum interval of 5 seconds
  const currentIntervalRef = useRef(baseInterval);

  // Save history to file system
  const saveHistoryToStorage = async (history: ClipboardItem[]) => {
    try {
      const historyData = JSON.stringify({ items: history });
      await invoke("save_clipboard_history", { historyData });
    } catch (error) {
      console.error("Failed to save history to storage:", error);
    }
  };

  // Load history from file system
  const loadHistoryFromStorage = async () => {
    try {
      const historyData = await invoke<string>("load_clipboard_history");
      const parsed = JSON.parse(historyData);
      const migratedItems = (parsed.items || []).map((item: any) => ({
        ...item,
        pinned: item.pinned ?? false,
      }));
      setClipboardHistory(migratedItems);
    } catch (error) {
      console.error("Failed to load history from storage:", error);
    }
  };

  // Check clipboard content
  const checkClipboard = async () => {
    // if (isInClearing.current) return;

    try {
      const currentContent = await invoke<string>("get_clipboard");

      if (currentContent === null || currentContent === undefined) {
        console.log("Empty clipboard detected, will check again later");
        return; // Skip processing for empty clipboard
      }

      if (currentContent && currentContent !== lastClipboardContent) {
        // Reset interval when clipboard changes
        currentIntervalRef.current = baseInterval;
        noChangeCountRef.current = 0;

        setLastClipboardContent(currentContent);

        setClipboardHistory((prev: any) => {
          if (prev.some((item: any) => item.text === currentContent)) {
            return prev;
          }

          const newItem = {
            id: Date.now(),
            text: currentContent,
            timestamp: Date.now(),
            pinned: false,
          };

          const updatedHistory = [newItem, ...prev.slice(0, 99)];
          saveHistoryToStorage(updatedHistory);
          return updatedHistory;
        });
      } else {
        // Increase interval gradually when no changes detected
        noChangeCountRef.current++;

        // Adjust the interval (exponential backoff with cap)
        if (noChangeCountRef.current > 5) {
          // Increase interval after 5 consecutive checks with no changes
          currentIntervalRef.current = Math.min(
            currentIntervalRef.current * 1.5,
            maxInterval
          );
        }
      }
    } catch (error) {
      console.error("Clipboard monitoring error:", error);
    }

    // Schedule next check with dynamic interval
    clipboardIntervalRef.current = window.setTimeout(
      checkClipboard,
      currentIntervalRef.current
    );
  };

  // Start monitoring clipboard for changes
  const startClipboardMonitoring = () => {
    // Initial check
    checkClipboard();
  };

  // Stop clipboard monitoring
  const stopClipboardMonitoring = () => {
    if (clipboardIntervalRef.current) {
      clearTimeout(clipboardIntervalRef.current);
      clipboardIntervalRef.current = null;
    }
  };

  // Inside your useClipboardHistory hook
  const refreshClipboardHistory = async () => {
    try {
      await loadHistoryFromStorage();
      return true;
    } catch (error) {
      console.error("Failed to refresh clipboard history:", error);
      return false;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await invoke("set_clipboard", { text });

      // Reset interval when user explicitly copies something
      currentIntervalRef.current = baseInterval;
      noChangeCountRef.current = 0;

      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  };

  const clearHistory = async () => {
    isInClearing.current = true;
    setClipboardHistory([]);
    saveHistoryToStorage([]);

    // Also clear system clipboard
    try {
      await invoke("clear_system_clipboard");
    } catch (error) {
      console.error("Failed to clear system clipboard:", error);
    }

    setTimeout(() => {
      isInClearing.current = false;
    }, 2000);
  };

  const deleteHistoryItem = async (id: number) => {
    // Find item to be deleted
    const itemToDelete = clipboardHistory.find((item) => item.id === id);

    setClipboardHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      saveHistoryToStorage(filtered);
      return filtered;
    });

    // If item to delete is currently in system clipboard, clear it or replace it
    if (itemToDelete) {
      try {
        // Get current clipboard content
        const currentClipboardText = await invoke("get_clipboard");

        if (currentClipboardText === itemToDelete.text) {
          // Find the next most recent item to replace with (optional)
          const remainingItems = clipboardHistory.filter(
            (item) => item.id !== id
          );
          const replacementText =
            remainingItems.length > 0
              ? remainingItems.sort((a, b) => b.timestamp - a.timestamp)[0].text
              : null;

          // Delete from system clipboard
          await invoke("delete_from_clipboard", {
            currentText: itemToDelete.text,
            replacementText: replacementText,
          });
        }
      } catch (error) {
        console.error("Failed to manage system clipboard:", error);
      }
    }
  };

  // Initialize and cleanup
  useEffect(() => {
    loadHistoryFromStorage();
    startClipboardMonitoring();

    // Reset interval when window regains focus
    const handleFocus = () => {
      currentIntervalRef.current = baseInterval;
      noChangeCountRef.current = 0;
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      stopClipboardMonitoring();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return {
    clipboardHistory,
    copyToClipboard,
    clearHistory,
    deleteHistoryItem,
    refreshClipboardHistory,
  };
};
