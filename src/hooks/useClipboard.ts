import { useState, useEffect, useRef } from "react";
import { clipboard } from "@tauri-apps/api";

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

  // Start monitoring clipboard for changes
  const startClipboardMonitoring = () => {
    // Check every 1 second (adjust as needed)
    clipboardIntervalRef.current = window.setInterval(async () => {
      // Skip checking if we're in the process of clearing the clipboard
      if (isInClearing.current) return;

      try {
        const currentContent = await clipboard.readText();

        // Only add to history if content changed and isn't empty
        if (currentContent && currentContent !== lastClipboardContent) {
          console.log("New clipboard content:", currentContent);
          setLastClipboardContent(currentContent);

          // Add to history (at beginning of array)
          setClipboardHistory((prev) => {
            // Check if this content already exists in recent history to avoid duplicates
            if (prev.some((item) => item.text === currentContent)) {
              return prev; // Don't add duplicates
            }

            const newItem = {
              id: Date.now(),
              text: currentContent,
              timestamp: Date.now(),
            };

            // Store in localStorage for persistence
            const updatedHistory = [newItem, ...prev.slice(0, 99)]; // Keep last 100 items
            saveHistoryToStorage(updatedHistory);

            return updatedHistory;
          });
        }
      } catch (error) {
        console.error("Clipboard monitoring error:", error);
      }
    }, 1000);
  };

  // Stop monitoring clipboard
  const stopClipboardMonitoring = () => {
    if (clipboardIntervalRef.current) {
      clearInterval(clipboardIntervalRef.current);
      clipboardIntervalRef.current = null;
    }
  };

  // Copy item from history to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  };

  // Clear all clipboard history
  const clearHistory = () => {
    isInClearing.current = true;
    setClipboardHistory([]);
    localStorage.removeItem("clipboardHistory");

    // Reset the flag after a short delay
    setTimeout(() => {
      isInClearing.current = false;
    }, 2000);
  };

  // Delete a specific item from history
  const deleteHistoryItem = (id: number) => {
    setClipboardHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== id);
      saveHistoryToStorage(filtered);
      return filtered;
    });
  };

  // Save history to localStorage
  const saveHistoryToStorage = (history: ClipboardItem[]) => {
    try {
      localStorage.setItem("clipboardHistory", JSON.stringify(history));
    } catch (error) {
      console.error("Failed to save history to storage:", error);
    }
  };

  // Load history from localStorage
  const loadHistoryFromStorage = () => {
    try {
      const stored = localStorage.getItem("clipboardHistory");
      if (stored) {
        const parsed = JSON.parse(stored);
        setClipboardHistory(parsed);
      }
    } catch (error) {
      console.error("Failed to load history from storage:", error);
    }
  };

  // Initialize
  useEffect(() => {
    loadHistoryFromStorage();
    startClipboardMonitoring();

    // Cleanup on unmount
    return () => {
      stopClipboardMonitoring();
    };
  }, []); // No dependencies to prevent loops

  return {
    clipboardHistory,
    copyToClipboard,
    clearHistory,
    deleteHistoryItem,
  };
};
