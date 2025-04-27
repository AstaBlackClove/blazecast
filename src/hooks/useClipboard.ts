import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export interface ClipboardItem {
  id: number;
  type: "text" | "image";
  text?: string;
  imageData?: {
    width: number;
    height: number;
    hash: string;
    filePath: string;
  };
  pinned: boolean;
  timestamp: number;
  last_copied: number;
  copy_count: number;
}
export const useClipboardHistory = () => {
  const [clipboardHistory, setClipboardHistory] = useState<any>([]);
  const [lastClipboardContent, setLastClipboardContent] = useState("");
  const clipboardIntervalRef = useRef<number | null>(null);
  const isInClearing = useRef(false);
  const isDeleting = useRef(false);

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
        copy_count: item.copy_count ?? 1,
        last_copied: item.last_copied ?? item.timestamp,
      }));
      setClipboardHistory(migratedItems);
    } catch (error) {
      console.error("Failed to load history from storage:", error);
    }
  };

  const getFilteredHistory = (query: string) => {
    return query
      ? clipboardHistory.filter((item: any) =>
          item.text.toLowerCase().includes(query.toLowerCase())
        )
      : clipboardHistory;
  };

  // Check clipboard content
  const checkClipboard = async () => {
    // Clear any existing scheduled checks
    if (clipboardIntervalRef.current) {
      clearTimeout(clipboardIntervalRef.current);
      clipboardIntervalRef.current = null;
    }

    if (isInClearing.current || isDeleting.current) {
      // Re-schedule next check even when skipping the current one
      clipboardIntervalRef.current = window.setTimeout(
        checkClipboard,
        currentIntervalRef.current
      );
      return;
    }

    try {
      // First try to get text from clipboard
      const currentTextContent = await invoke<string>("get_clipboard").catch(
        () => null
      );

      // Then try to get image from clipboard
      const currentImageContent = await invoke<{
        width: number;
        height: number;
        hash: string;
        file_path: string;
      } | null>("get_clipboard_image").catch(() => null);

      // If both are null/undefined, clipboard is empty
      if (!currentTextContent && !currentImageContent) {
        console.log("Empty clipboard detected, will check again later");
      }
      // Check if we have new text content
      else if (
        currentTextContent &&
        currentTextContent !== lastClipboardContent
      ) {
        // Reset interval when clipboard changes
        currentIntervalRef.current = baseInterval;
        noChangeCountRef.current = 0;

        setLastClipboardContent(currentTextContent);

        setClipboardHistory((prev: any) => {
          // Check if this text already exists in history
          if (
            prev.some(
              (item: any) =>
                item.type === "text" && item.text === currentTextContent
            )
          ) {
            return prev;
          }

          const newItem: ClipboardItem = {
            id: Date.now(),
            type: "text",
            text: currentTextContent,
            timestamp: Date.now(),
            last_copied: Date.now(),
            pinned: false,
            copy_count: 1,
          };

          const updatedHistory = [newItem, ...prev.slice(0, 99)];
          saveHistoryToStorage(updatedHistory);
          return updatedHistory;
        });
      }
      // Check if we have new image content
      else if (currentImageContent) {
        // Reset interval when clipboard changes
        currentIntervalRef.current = baseInterval;
        noChangeCountRef.current = 0;

        // Use image hash to check if we already have this image
        setClipboardHistory((prev: any) => {
          // Check if this image already exists in history by hash
          if (
            prev.some(
              (item: any) =>
                item.type === "image" &&
                item.imageData?.hash === currentImageContent.hash
            )
          ) {
            return prev;
          }

          const newItem: ClipboardItem = {
            id: Date.now(),
            type: "image",
            imageData: {
              width: currentImageContent.width,
              height: currentImageContent.height,
              hash: currentImageContent.hash,
              filePath: currentImageContent.file_path,
            },
            timestamp: Date.now(),
            last_copied: Date.now(),
            pinned: false,
            copy_count: 1,
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

    // Always schedule next check with dynamic interval, even if there was an error
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

      const now = Date.now();

      // Update copy count and lastCopied timestamp for this item
      setClipboardHistory((prev: any) => {
        const updatedHistory = prev.map((item: any) => {
          if (item.text === text) {
            return {
              ...item,
              copy_count: (item.copy_count || 0) + 1,
              last_copied: now,
            };
          }
          return item;
        });
        saveHistoryToStorage(updatedHistory);
        return updatedHistory;
      });

      return true;
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      return false;
    }
  };

  const clearHistory = async () => {
    isInClearing.current = true;

    try {
      // Filter out image items from the clipboard history
      const imageItems = clipboardHistory.filter(
        (item: ClipboardItem) =>
          item.type === "image" && item.imageData?.filePath
      );

      // Only process image deletion if there are actually images
      if (imageItems.length > 0) {
        console.log(`Deleting ${imageItems.length} image files...`);

        // Delete each image file
        for (const item of imageItems) {
          if (item.imageData?.filePath) {
            try {
              await invoke("delete_clipboard_image_file", {
                filePath: item.imageData.filePath,
              });
            } catch (error) {
              console.error(
                `Failed to delete image file: ${item.imageData.filePath}`,
                error
              );
            }
          }
        }
      }

      // Clear system clipboard
      await invoke("clear_system_clipboard");

      // Update state and storage
      setClipboardHistory([]);
      saveHistoryToStorage([]);
    } catch (error) {
      console.error("Error during history clearing:", error);
    } finally {
      // Reset the flag after a delay and restart clipboard monitoring
      setTimeout(() => {
        isInClearing.current = false;
        // Force a clipboard check after clearing completes
        checkClipboard();
      }, 2000);
    }
  };

  const deleteHistoryItem = async (id: number) => {
    // Set flag to temporarily pause clipboard monitoring
    isDeleting.current = true;

    // Find item to be deleted
    const itemToDelete = clipboardHistory.find((item: any) => item.id === id);

    try {
      // If the item is at index 0 and is an image, we need special handling
      const isFirstItem =
        clipboardHistory.findIndex((item: any) => item.id === id) === 0;

      // Handle image file deletion first
      if (
        itemToDelete &&
        itemToDelete.type === "image" &&
        itemToDelete.imageData?.filePath
      ) {
        await invoke("delete_clipboard_image_file", {
          filePath: itemToDelete.imageData.filePath,
        });

        // If it's the first item, we need to clear the system clipboard
        if (isFirstItem) {
          await invoke("clear_system_clipboard");
        }
      }

      // Update state after file operations
      setClipboardHistory((prev: any) => {
        const filtered = prev.filter((item: any) => item.id !== id);
        saveHistoryToStorage(filtered);
        return filtered;
      });

      // Text clipboard management (if needed)
      if (itemToDelete && itemToDelete.type === "text" && itemToDelete.text) {
        const currentClipboardText = await invoke("get_clipboard");

        if (currentClipboardText === itemToDelete.text) {
          // Your existing replacement code...
        }
      }
    } catch (error) {
      console.error("Failed to manage system clipboard:", error);
    } finally {
      // Reset the flag after a delay and manually trigger a clipboard check
      setTimeout(() => {
        isDeleting.current = false;
        // Force a clipboard check after deletion completes
        checkClipboard();
      }, 1000);
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
      // Force a clipboard check when window gets focus
      checkClipboard();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      stopClipboardMonitoring();
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return {
    clipboardHistory,
    getFilteredHistory,
    copyToClipboard,
    clearHistory,
    deleteHistoryItem,
    refreshClipboardHistory,
  };
};
