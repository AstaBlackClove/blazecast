import React, { useState, useEffect, useRef } from "react";
import { ClipboardItem } from "../../hooks/useClipboard";

interface ClipboardHistoryProps {
  history: ClipboardItem[];
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  onClear: () => void;
}

export const ClipboardHistory: React.FC<ClipboardHistoryProps> = ({
  history,
  onCopy,
  onDelete,
  onClear,
}) => {
  // const [copyStatus, setCopyStatus] = useState<
  //   "idle" | "copying" | "success" | "error"
  // >("idle");
  const [selectedIndex, setSelectedIndex] = useState<number>(
    history.length > 0 ? 0 : -1
  );
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [menuSelectedIndex, setMenuSelectedIndex] = useState<number>(0);
  const historyRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showActionMenu) {
        // Menu navigation
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setMenuSelectedIndex((prev) => (prev < 2 ? prev + 1 : prev));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setMenuSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (menuSelectedIndex === 0) {
            onCopy(history[selectedIndex].text);
          } else if (menuSelectedIndex === 1) {
            onDelete(history[selectedIndex].id);
          }
          setShowActionMenu(false);
        } else if (e.key === "Escape") {
          e.preventDefault();
          setShowActionMenu(false);
        }
      } else {
        // Main list navigation
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < history.length - 1 ? prev + 1 : prev
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === "Enter" && selectedIndex >= 0) {
          e.preventDefault();
          onCopy(history[selectedIndex].text);
        } else if (e.key === "k" && e.ctrlKey) {
          e.preventDefault();
          if (selectedIndex >= 0) {
            const selectedItem = document.getElementById(
              `clipboard-item-${selectedIndex}`
            );
            if (selectedItem) {
              const rect = selectedItem.getBoundingClientRect();
              setMenuPosition({ x: rect.right - 150, y: rect.bottom });
              setShowActionMenu(true);
              setMenuSelectedIndex(0);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    history,
    selectedIndex,
    showActionMenu,
    menuSelectedIndex,
    onCopy,
    onDelete,
  ]);

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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && historyRef.current) {
      const selectedItem = document.getElementById(
        `clipboard-item-${selectedIndex}`
      );
      if (selectedItem) {
        selectedItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleItemClick = (index: number) => {
    setSelectedIndex(index);
  };

  const openActionMenu = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedIndex(index);
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowActionMenu(true);
    setMenuSelectedIndex(0);
  };

  // Get the currently selected item
  const selectedItem =
    selectedIndex >= 0 && selectedIndex < history.length
      ? history[selectedIndex]
      : null;

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 text-gray-200 overflow-hidden">
      <div className="flex justify-between items-center p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center">
          <h2 className="text-lg font-medium">Clipboard History</h2>
          <div className="ml-4 relative">
            <input
              type="text"
              placeholder="Type to filter entries..."
              className="bg-gray-700 text-sm rounded px-3 py-1 pl-8 w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
              <svg
                className="w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>
        <button
          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
          onClick={onClear}
        >
          Clear All
        </button>
      </div>

      <div className="flex flex-grow overflow-hidden h-full">
        <div className="w-1/4 border-r border-gray-700 bg-gray-800 flex flex-col h-full">
          <div className="p-3 border-b">
            <div className="font-medium mb-2">Pinned</div>
            <div className="text-gray-400 text-sm mb-1">#FF6363</div>
            <div className="text-gray-400 text-sm mb-4">
              https://raycast.com
            </div>

            {/* <div className="font-medium mb-2">Most recent</div> */}
            <div className="font-medium">Clipboard items</div>
          </div>
          <div ref={historyRef} className="flex-grow overflow-y-auto">
            {history.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                Your clipboard history will appear here
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                {history.map((item, index) => (
                  <div
                    id={`clipboard-item-${index}`}
                    key={item.id}
                    className={`p-3 border-b border-gray-700 hover:bg-gray-800 flex justify-between ${
                      selectedIndex === index ? "bg-gray-700" : ""
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

        <div className="flex-grow p-3 border-l border-gray-700 bg-gray-800 overflow-y-auto">
          {selectedItem ? (
            <>
              <div className=" border-gray-700 mb-2">
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
                  <span>2</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-400">Last copied</span>
                  <span>{formatDate(selectedItem.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">First copied</span>
                  <span>{formatDate(selectedItem.timestamp)}</span>
                </div>
              </div>

              {/* <div className="mt-4">
                <button
                  className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"
                  onClick={async () => {
                    setCopyStatus("copying");
                    try {
                      await onCopy(selectedItem.text);
                      setCopyStatus("success");
                      setTimeout(() => setCopyStatus("idle"), 2000);
                    } catch (err) {
                      setCopyStatus("error");
                      setTimeout(() => setCopyStatus("idle"), 2000);
                    }
                  }}
                  disabled={copyStatus === "copying"}
                >
                  <span>
                    {copyStatus === "copying"
                      ? "Copying..."
                      : copyStatus === "success"
                      ? "Copied!"
                      : copyStatus === "error"
                      ? "Failed to copy"
                      : "Copy to Clipboard"}
                  </span>
                  <span className="ml-2 bg-gray-600 text-xs px-1.5 py-0.5 rounded">
                    ⌘
                  </span>
                </button>
              </div> */}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select an item to view details
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <div>Actions</div>
          <div className="flex items-center space-x-2">
            {/* <span className="bg-gray-800 px-2 py-1 rounded">↵</span>
            <span>Copy</span> */}
            <span className="bg-gray-800 px-2 py-1 rounded">CTRL + K</span>
            <span>Menu</span>
          </div>
        </div>
      </div>

      {showActionMenu && selectedIndex >= 0 && (
        <div
          ref={menuRef}
          className="absolute bg-gray-800 border border-gray-700 rounded shadow-lg z-10"
          style={{ top: menuPosition.y, left: menuPosition.x }}
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
            <button
              className={`w-full text-left px-3 py-1.5 rounded flex items-center ${
                menuSelectedIndex === 2 ? "bg-gray-700" : "hover:bg-gray-700"
              }`}
              onClick={() => setShowActionMenu(false)}
            >
              <span className="mr-2">📌</span>
              <span>Pin</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
