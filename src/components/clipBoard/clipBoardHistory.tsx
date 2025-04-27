import React, { useState, useEffect, useRef } from "react";
import { ClipboardItem, useClipboardHistory } from "../../hooks/useClipboard";
import { invoke } from "@tauri-apps/api/tauri";
import { ClipboardImage } from "./clipBoardimg";

interface ClipboardHistoryProps {
  history: ClipboardItem[];
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  onClear: () => void;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  onPinSuccess: () => void;
}

export const ClipboardHistory: React.FC<ClipboardHistoryProps> = ({
  history,
  onCopy,
  onDelete,
  onClear,
  selectedIndex,
  setSelectedIndex,
  onPinSuccess,
}) => {
  const pinnedItems = history.filter((item) => item.pinned);
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);
  const [menuSelectedIndex, setMenuSelectedIndex] = useState<number>(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);
  const maxPins = 3;
  const canAddPin = pinnedItems.length < maxPins;

  const { copyImageAndHide } = useClipboardHistory();

  const pinItem = async (id: number) => {
    try {
      console.log("Pinning item with ID:", id);
      const itemToBePinned = history.find((item) => item.id === id);
      console.log("Item to be pinned:", itemToBePinned);

      await invoke("pin_clipboard_item", { itemId: id });
      console.log("Pin operation completed");
      onPinSuccess();
    } catch (error) {
      console.error("❌ Failed to pin item:", error);
    }
  };

  // Validate if the item can be pinned
  const canPinItem = (itemId: number) => {
    const item = history.find((item) => item.id === itemId);
    if (!item) return false;
    return item.pinned || canAddPin;
  };

  // Format timestamp to display in a readable format
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();

    // Check if the date is today
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    // Check if the date is yesterday
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    // Format the time part
    const timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    if (isToday) {
      return `Today at ${timeString}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeString}`;
    } else {
      // For dates older than yesterday, just show the date (no "at time")
      return date.toLocaleDateString();
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };

    if (showActionMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActionMenu]);

  // Handle keyboard shortcuts for pinned items and other actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CTRL+K to open action menu
      if (e.ctrlKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (selectedIndex >= 0) {
          setShowActionMenu(true);
          setMenuSelectedIndex(0);
        }
      }

      // SHIFT+P to pin/unpin
      if (e.shiftKey && e.key.toLowerCase() === "p" && selectedIndex >= 0) {
        e.preventDefault();
        const selectedItem = history[selectedIndex];
        if (selectedItem && canPinItem(selectedItem.id)) {
          pinItem(selectedItem.id);
        }
      }

      // SHIFT+D to delete
      if (
        e.shiftKey &&
        !e.altKey &&
        e.key.toLowerCase() === "d" &&
        selectedIndex >= 0
      ) {
        e.preventDefault();
        const selectedItem = history[selectedIndex];
        if (selectedItem) {
          onDelete(selectedItem.id);
        }
      }

      // ALT+SHIFT+D to delete all
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        onClear();
      }

      // ALT + number to copy pinned items (1-9)
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const numKey = parseInt(e.key);
        if (!isNaN(numKey) && numKey >= 1 && numKey <= 9) {
          e.preventDefault();
          const pinnedIndex = numKey - 1;
          if (pinnedIndex < pinnedItems.length) {
            const pinnedItem = pinnedItems[pinnedIndex];
            if (pinnedItem.type === "text" && pinnedItem.text) {
              onCopy(pinnedItem.text);
            } else if (
              pinnedItem.type === "image" &&
              pinnedItem.imageData?.filePath
            ) {
              copyImageAndHide(pinnedItem.imageData.filePath);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    pinnedItems,
    selectedIndex,
    history,
    onCopy,
    onDelete,
    onClear,
    canAddPin,
  ]);

  // Focus the menu when it opens
  useEffect(() => {
    if (showActionMenu && menuRef.current) {
      menuRef.current.focus();
    }
  }, [showActionMenu]);

  const handleItemClick = (index: number) => {
    setSelectedIndex(index);
  };

  const openActionMenu = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedIndex(index);
    setShowActionMenu(true);
    setMenuSelectedIndex(0);
  };

  const handleMenuSelect = (index: number) => {
    const selectedItem = history[selectedIndex];
    if (!selectedItem) return;

    switch (index) {
      case 0: // Copy
        if (selectedItem.type === "text" && selectedItem.text) {
          onCopy(selectedItem.text);
        } else if (
          selectedItem.type === "image" &&
          selectedItem.imageData?.filePath
        ) {
          copyImageAndHide(selectedItem.imageData.filePath);
        }
        break;
      case 1: // Delete
        onDelete(selectedItem.id);
        break;
      case 2: // Pin/Unpin
        if (canPinItem(selectedItem.id)) {
          pinItem(selectedItem.id);
        }
        break;
      case 3: // Clear All
        onClear();
        break;
    }
    setShowActionMenu(false);

    // Focus back to CommandInput after action
    const commandInput = document.getElementById("command-input");
    if (commandInput) {
      (commandInput as HTMLInputElement).focus();
    }
  };

  const handleHistoryKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < history.length) {
        const selectedItem = history[selectedIndex];
        if (selectedItem.type === "text" && selectedItem.text) {
          onCopy(selectedItem.text);
          // Close window after copying text
          invoke("close_main_window").catch((error) => {
            console.error("Failed to close window:", error);
          });
        } else if (
          selectedItem.type === "image" &&
          selectedItem.imageData?.filePath
        ) {
          console.log("triggered");
          copyImageAndHide(selectedItem.imageData.filePath);
        }
      }
    } else if (e.key === "Delete") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < history.length) {
        onDelete(history[selectedIndex].id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      const commandInput = document.getElementById("command-input");
      if (commandInput) {
        (commandInput as HTMLInputElement).focus();
      }
    }
  };

  // Get the currently selected item
  const selectedItem =
    selectedIndex >= 0 && selectedIndex < history.length
      ? history[selectedIndex]
      : null;

  // Function to render item content preview in history list
  const renderItemPreview = (item: ClipboardItem) => {
    if (item.type === "text" && item.text) {
      return (
        <div className="mt-1 overflow-hidden overflow-ellipsis whitespace-nowrap">
          {item.text.length > 100
            ? `${item.text.substring(0, 100)}...`
            : item.text}
        </div>
      );
    } else if (item.type === "image" && item.imageData) {
      return (
        <div className="mt-1 text-xs text-gray-400">
          [Image {item.imageData.width}x{item.imageData.height}]
        </div>
      );
    }
    return <div className="mt-1 text-xs text-gray-400">[Unknown content]</div>;
  };

  return (
    <div
      ref={appRef}
      className="flex flex-col w-full h-full bg-gray-900 text-gray-200 overflow-hidden"
    >
      <div className="flex flex-grow overflow-hidden h-full">
        <div className="w-1/3 border-r border-gray-700 bg-gray-800 flex flex-col h-full">
          {/* Pinned section */}
          {pinnedItems.length > 0 && (
            <>
              <div className="text-xs font-bold text-gray-400 px-3 py-2 bg-gray-700">
                📌 Pinned ({pinnedItems.length}/{maxPins})
              </div>
              {pinnedItems.map((item, index) => (
                <div
                  id={`clipboard-item-pinned-${index}`}
                  key={`pinned-${item.id}`}
                  className="p-3 border-b border-gray-700 hover:bg-gray-800 flex justify-between"
                  onClick={() => {
                    const itemIndex = history.findIndex(
                      (h) => h.id === item.id
                    );
                    if (itemIndex !== -1) {
                      handleItemClick(itemIndex);
                    }
                  }}
                  onContextMenu={(e) => {
                    const itemIndex = history.findIndex(
                      (h) => h.id === item.id
                    );
                    if (itemIndex !== -1) {
                      openActionMenu(itemIndex, e);
                    }
                  }}
                >
                  {/* Render pinned item with shortcut hint */}
                  <div className="flex flex-col w-full">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(item.timestamp)}
                        </span>
                        {index < 9 && (
                          <span className="ml-2 text-xs bg-gray-700 px-1.5 py-0.5 rounded text-gray-300">
                            ALT+{index + 1}
                          </span>
                        )}
                      </div>
                    </div>
                    {renderItemPreview(item)}
                  </div>
                </div>
              ))}
            </>
          )}
          {/* History section */}
          <div
            ref={historyRef}
            className="flex-grow overflow-y-auto"
            tabIndex={0}
            onKeyDown={handleHistoryKeyDown}
          >
            <div className="text-xs font-bold text-gray-400 px-3 py-2 bg-gray-700">
              📝 Clipboard History
            </div>
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                No Data
              </div>
            ) : (
              <div className="h-full">
                {history.map((item, index) => (
                  <div
                    id={`clipboard-item-${index}`}
                    key={item.id}
                    className={`p-3 border-b border-gray-700 hover:bg-gray-800 flex justify-between ${
                      selectedIndex === index ? "bg-gray-900" : ""
                    }`}
                    onClick={() => handleItemClick(index)}
                    onContextMenu={(e) => openActionMenu(index, e)}
                  >
                    <div className="flex flex-col w-full">
                      <div className="flex justify-between items-start">
                        <span className="text-xs text-gray-400">
                          {formatTimestamp(item.timestamp)}
                        </span>
                        <div className="flex items-center">
                          {item.pinned && (
                            <span className="text-xs text-yellow-400 mr-2">
                              📌
                            </span>
                          )}
                          {item.type === "image" && (
                            <span className="text-xs text-blue-400">Image</span>
                          )}
                        </div>
                      </div>
                      {renderItemPreview(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Selected item section */}
        <div className="flex-grow p-3 border-l border-gray-700 bg-gray-800 overflow-y-auto">
          {selectedItem ? (
            <>
              <div className="border-gray-700 mb-2">
                <h3 className="font-medium mb-2">Content</h3>
                <div className="bg-gray-900 p-3 rounded overflow-y-auto max-h-52">
                  {selectedItem.type === "text" && selectedItem.text ? (
                    <pre className="text-sm whitespace-pre-wrap break-words">
                      {selectedItem.text}
                    </pre>
                  ) : selectedItem.type === "image" &&
                    selectedItem.imageData ? (
                    <ClipboardImage
                      filePath={selectedItem.imageData.filePath}
                    />
                  ) : (
                    <span className="text-gray-400">Unknown content type</span>
                  )}
                </div>
              </div>

              <div className="font-medium mb-2">Information</div>
              <div className="text-sm mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Type</span>
                  <span>{selectedItem.type}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Times copied</span>
                  <span>{selectedItem.copy_count || 1}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Last copied</span>
                  <span>
                    {formatDate(
                      selectedItem.last_copied || selectedItem.timestamp
                    )}
                  </span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">First copied</span>
                  <span>{formatDate(selectedItem.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Pinned</span>
                  <span>{selectedItem.pinned ? "Yes" : "No"}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select an item to view details
            </div>
          )}
        </div>
      </div>
      {/* Footer */}
      <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <div>Actions</div>
          <div className="flex space-x-5">
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">ENT</span>
              <span>Copy</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">SHIFT+P</span>
              <span>Pin/Unpin</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">SHIFT+D</span>
              <span>Delete</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">CTRL+K</span>
              <span>Menu</span>
            </div>
            {pinnedItems.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="bg-gray-800 px-2 py-1 rounded">ALT+1-9</span>
                <span>Copy Pinned</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Menu popup */}
      {showActionMenu && selectedIndex >= 0 && (
        <div
          ref={menuRef}
          tabIndex={0}
          className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg z-10 focus:outline-none"
          style={{ bottom: "60px", right: "20px", width: "250px" }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setShowActionMenu(false);
              const commandInput = document.getElementById("command-input");
              if (commandInput) {
                (commandInput as HTMLInputElement).focus();
              }
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              const totalItems =
                history[selectedIndex]?.pinned || canAddPin ? 4 : 3;
              setMenuSelectedIndex((prev) => (prev + 1) % totalItems);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              const totalItems =
                history[selectedIndex]?.pinned || canAddPin ? 4 : 3;
              setMenuSelectedIndex(
                (prev) => (prev - 1 + totalItems) % totalItems
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              handleMenuSelect(menuSelectedIndex);
            }
          }}
        >
          <div className="p-1">
            <button
              className={`w-full text-left px-3 py-1.5 rounded flex justify-between items-center ${
                menuSelectedIndex === 0 ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
              onClick={() => {
                const selectedItem = history[selectedIndex];
                if (selectedItem.type === "text" && selectedItem.text) {
                  onCopy(selectedItem.text);
                } else if (
                  selectedItem.type === "image" &&
                  selectedItem.imageData?.filePath
                ) {
                  invoke("set_clipboard_image", {
                    filePath: selectedItem.imageData.filePath,
                  }).catch((error) => {
                    console.error("Failed to copy image to clipboard:", error);
                  });
                }
                setShowActionMenu(false);
              }}
            >
              <div className="flex items-center">
                <span className="mr-2">📋</span>
                <span>Copy</span>
              </div>
              <span className="text-xs bg-gray-900 px-1.5 py-0.5 rounded text-gray-300">
                ENT
              </span>
            </button>
            <button
              className={`w-full text-left px-3 py-1.5 rounded flex justify-between items-center ${
                menuSelectedIndex === 1 ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
              onClick={() => {
                onDelete(history[selectedIndex].id);
                setShowActionMenu(false);
              }}
            >
              <div className="flex items-center">
                <span className="mr-2">🗑️</span>
                <span>Delete</span>
              </div>
              <span className="text-xs bg-gray-900 px-1.5 py-0.5 rounded text-gray-300">
                SHIFT+D
              </span>
            </button>

            {/* Only show Pin/Unpin option if it's already pinned or we can add more pins */}
            {(history[selectedIndex]?.pinned || canAddPin) && (
              <button
                className={`w-full text-left px-3 py-1.5 rounded flex justify-between items-center ${
                  menuSelectedIndex === 2 ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
                onClick={() => {
                  const selectedItem = history[selectedIndex];
                  if (canPinItem(selectedItem.id)) {
                    pinItem(selectedItem.id);
                  }
                  setShowActionMenu(false);
                }}
              >
                <div className="flex items-center">
                  <span className="mr-2">
                    {history[selectedIndex]?.pinned ? "📌" : "📌"}
                  </span>
                  <span>
                    {history[selectedIndex]?.pinned ? "Unpin" : "Pin"}
                  </span>
                </div>
                <span className="text-xs bg-gray-900 px-1.5 py-0.5 rounded text-gray-300">
                  SHIFT+P
                </span>
              </button>
            )}

            <div className="border-t border-gray-700">
              <button
                className={`w-full text-left px-3 py-1.5 rounded flex justify-between items-center mt-1 ${
                  menuSelectedIndex ===
                  (history[selectedIndex]?.pinned || canAddPin ? 3 : 2)
                    ? "bg-gray-700"
                    : "hover:bg-gray-700"
                }`}
                onClick={() => {
                  onClear();
                  setShowActionMenu(false);
                }}
              >
                <div className="flex items-center">
                  <span className="mr-2">🧹</span>
                  <span>Clear All</span>
                </div>
                <span className="text-xs bg-gray-900 px-1.5 py-0.5 rounded text-gray-300">
                  ALT+SHIFT+D
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
