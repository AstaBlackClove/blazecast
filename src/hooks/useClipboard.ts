import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export interface ClipboardItem {
  id: number;
  text: string;
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
      setClipboardHistory(parsed.items || []);
    } catch (error) {
      console.error("Failed to load history from storage:", error);
    }
  };

  // Check clipboard content
  const checkClipboard = async () => {
    if (isInClearing.current) return;

    try {
      const currentContent = await invoke<string>("get_clipboard");

      if (currentContent && currentContent !== lastClipboardContent) {
        // Reset interval when clipboard changes
        currentIntervalRef.current = baseInterval;
        noChangeCountRef.current = 0;

        console.log("New clipboard content detected");
        setLastClipboardContent(currentContent);

        setClipboardHistory((prev) => {
          if (prev.some((item) => item.text === currentContent)) {
            return prev;
          }

          const newItem = {
            id: Date.now(),
            text: currentContent,
            timestamp: Date.now(),
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

  const clearHistory = () => {
    isInClearing.current = true;
    setClipboardHistory([]);
    saveHistoryToStorage([]);
    setTimeout(() => {
      isInClearing.current = false;
    }, 2000);
  };

  const deleteHistoryItem = (id: number) => {
    setClipboardHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      saveHistoryToStorage(filtered);
      return filtered;
    });
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
  };
};
