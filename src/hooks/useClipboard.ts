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

  // Start monitoring clipboard for changes
  const startClipboardMonitoring = () => {
    clipboardIntervalRef.current = window.setInterval(async () => {
      if (isInClearing.current) return;

      try {
        const currentContent = await invoke<string>("get_clipboard");

        if (currentContent && currentContent !== lastClipboardContent) {
          console.log("New clipboard content:", currentContent);
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
        }
      } catch (error) {
        console.error("Clipboard monitoring error:", error);
      }
    }, 1000);
  };

  // Rest of your hook implementation...
  const stopClipboardMonitoring = () => {
    if (clipboardIntervalRef.current) {
      clearInterval(clipboardIntervalRef.current);
      clipboardIntervalRef.current = null;
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await invoke("set_clipboard", { text });
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

  // Initialize
  useEffect(() => {
    loadHistoryFromStorage();
    startClipboardMonitoring();

    return () => {
      stopClipboardMonitoring();
    };
  }, []);

  return {
    clipboardHistory,
    copyToClipboard,
    clearHistory,
    deleteHistoryItem,
  };
};
