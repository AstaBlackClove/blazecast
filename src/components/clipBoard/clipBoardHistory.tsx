import React, { useState, useEffect, useRef } from "react";
import { ClipboardItem } from "../../hooks/useClipboard";
import { invoke } from "@tauri-apps/api/tauri";

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

  const pinItem = async (id: number) => {
    try {
      await invoke("pin_clipboard_item", { itemId: id });
    } catch (error) {
      console.error("❌ Failed to pin item:", error);
    }
  };

  // Format timestamp to display in a readable format
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `Today at ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })}`;
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

      // ALT + number to copy pinned items (1-9)
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        const numKey = parseInt(e.key);
        if (!isNaN(numKey) && numKey >= 1 && numKey <= 9) {
          e.preventDefault();
          const pinnedIndex = numKey - 1;
          if (pinnedIndex < pinnedItems.length) {
            onCopy(pinnedItems[pinnedIndex].text);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [pinnedItems, selectedIndex, onCopy]);

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
    switch (index) {
      case 0:
        onCopy(history[selectedIndex].text);
        break;
      case 1:
        onDelete(history[selectedIndex].id);
        break;
      case 2:
        pinItem(history[selectedIndex].id);
        onPinSuccess();
        break;
      case 3:
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
        onCopy(history[selectedIndex].text);
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

  return (
    <div
      ref={appRef}
      className="flex flex-col w-full h-full bg-gray-900 text-gray-200 overflow-hidden"
    >
      <div className="flex flex-grow overflow-hidden h-full">
        <div className="w-1/3 border-r border-gray-700 bg-gray-800 flex flex-col h-full">
          {/* //pinned section */}
          {pinnedItems.length > 0 && (
            <>
              <div className="text-xs font-bold text-gray-400 px-3 py-2 bg-gray-700">
                📌 Pinned
              </div>
              {pinnedItems.map((item, index) => (
                <div
                  id={`clipboard-item-pinned-${index}`}
                  key={item.id}
                  className="p-3 border-b border-gray-700 hover:bg-gray-800 flex justify-between"
                  onClick={() => handleItemClick(index)}
                  onContextMenu={(e) => openActionMenu(index, e)}
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
                    <div className="mt-1 overflow-hidden overflow-ellipsis whitespace-nowrap">
                      {item.text.length > 100
                        ? `${item.text.substring(0, 100)}...`
                        : item.text}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {/* //history section */}
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
                      </div>
                      <div className="mt-1 overflow-hidden overflow-ellipsis whitespace-nowrap">
                        {item.text.length > 100
                          ? `${item.text.substring(0, 100)}...`
                          : item.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* //selectd item section */}
        <div className="flex-grow p-3 border-l border-gray-700 bg-gray-800 overflow-y-auto">
          {selectedItem ? (
            <>
              <div className="border-gray-700 mb-2">
                <h3 className="font-medium mb-2">Content</h3>
                <div className="bg-gray-900 p-3 rounded overflow-y-auto max-h-52">
                  <pre className="text-sm whitespace-pre-wrap break-words">
                    {selectedItem.text}
                  </pre>
                </div>
              </div>

              <div className="font-medium mb-2">Information</div>
              <div className="text-sm mb-4">
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
                <div className="flex justify-between">
                  <span className="text-gray-400">First copied</span>
                  <span>{formatDate(selectedItem.timestamp)}</span>
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
      {/* //footer */}
      <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <div>Actions</div>
          <div className="flex space-x-5">
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">ENT</span>
              <span>Copy</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">CTRL + K</span>
              <span>Menu</span>
            </div>
            {pinnedItems.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="bg-gray-800 px-2 py-1 rounded">ALT + 1-9</span>
                <span>Copy Pinned</span>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* //menu popup */}
      {showActionMenu && selectedIndex >= 0 && (
        <div
          ref={menuRef}
          tabIndex={0}
          className="fixed bg-gray-800 border border-gray-700 rounded shadow-lg z-10 focus:outline-none"
          style={{ bottom: "60px", right: "20px", width: "180px" }}
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
              setMenuSelectedIndex((prev) => (prev + 1) % 4); // 4 menu items
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setMenuSelectedIndex((prev) => (prev - 1 + 4) % 4); // wrap around
            } else if (e.key === "Enter") {
              e.preventDefault();
              handleMenuSelect(menuSelectedIndex);
            }
          }}
        >
          <div className="p-1">
            <button
              className={`w-full text-left px-3 py-1.5 rounded flex items-center ${
                menuSelectedIndex === 0 ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
              onClick={() => {
                onCopy(history[selectedIndex].text);
                setShowActionMenu(false);
              }}
            >
              <span className="mr-2">📋</span>
              <span>Copy</span>
            </button>
            <button
              className={`w-full text-left px-3 py-1.5 rounded flex items-center ${
                menuSelectedIndex === 1 ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
              onClick={() => {
                onDelete(history[selectedIndex].id);
                setShowActionMenu(false);
              }}
            >
              <span className="mr-2">🗑️</span>
              <span>Delete</span>
            </button>
            {pinnedItems.length < 3 && (
              <button
                className={`w-full text-left px-3 py-1.5 rounded flex items-center mb-1 ${
                  menuSelectedIndex === 2 ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
                onClick={() => {
                  pinItem(history[selectedIndex].id);
                  setShowActionMenu(false);
                }}
              >
                <span className="mr-2">📌</span>
                <span>Pin</span>
              </button>
            )}
            <div className="border-t border-gray-700">
              <button
                className={`w-full text-left px-3 py-1.5 rounded flex items-center mt-1 ${
                  menuSelectedIndex === 3 ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
                onClick={() => {
                  onClear();
                  setShowActionMenu(false);
                }}
              >
                <span className="mr-2">🧹</span>
                <span>Clear All</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
