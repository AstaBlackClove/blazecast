import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { AppInfo, appToSuggestion, Suggestion } from "./types";
import { useSuggestions } from "./hooks/useSuggestion";
import { useClipboardHistory } from "./hooks/useClipboard";
import { ClipboardHistory } from "./components/clipBoard/clipBoardHistory";

function App() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentApps, setRecentApps] = useState<Suggestion[]>([]);
  const [mode, setMode] = useState<"apps" | "clipboard">("apps");
  const [resetTrigger, setResetTrigger] = useState(0);

  // Track if we're currently clearing the clipboard to prevent re-additions
  const isClearing = useRef(false);

  // Use our clipboard hook
  const {
    clipboardHistory,
    copyToClipboard,
    clearHistory,
    deleteHistoryItem,
    refreshClipboardHistory,
  } = useClipboardHistory();

  // Filter clipboard history based on query when in clipboard mode
  const filteredClipboardHistory =
    mode === "clipboard" && query
      ? clipboardHistory.filter((item) =>
          item.text.toLowerCase().includes(query.toLowerCase())
        )
      : clipboardHistory;

  // Load recent apps when the app starts
  const fetchRecentApps = async () => {
    try {
      const apps: AppInfo[] = await invoke("get_recent_apps");
      const recentSuggestions = apps.map((app) => ({
        ...appToSuggestion(app),
        action: async () => {
          await invoke("open_app", { appId: app.id });
        },
      }));

      setRecentApps(recentSuggestions);
    } catch (error) {
      console.error("Failed to fetch recent apps:", error);
    }
  };

  useEffect(() => {
    fetchRecentApps();
    // Check if user types "clip" to activate clipboard mode
    if (query.toLowerCase() === "clip") {
      setMode("clipboard");
      setQuery(""); // Clear the input after switching modes
      setResetTrigger((prev) => prev + 1);
      invoke("resize_window", { width: 900, height: 700 });
    }
  }, [query]);

  // Use the useSuggestions hook to fetch suggestions
  const suggestions: Suggestion[] = useSuggestions(query);

  // If query is empty, show recent apps
  const displayedSuggestions = query.trim() === "" ? recentApps : suggestions;

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  const handleSubmit = () => {
    if (mode === "apps" && displayedSuggestions.length > 0) {
      openSelectedApp();
    } else if (mode === "clipboard" && filteredClipboardHistory.length > 0) {
      // Copy the selected clipboard item if in clipboard mode
      handleCopyFromHistory(filteredClipboardHistory[selectedIndex].text);
    }
  };

  const scrollToClipboardItem = (index: number) => {
    const item = document.getElementById(`clipboard-item-${index}`);
    if (item) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleArrowUp = () => {
    if (mode === "apps") {
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : displayedSuggestions.length - 1
      );
    } else if (mode === "clipboard") {
      setSelectedIndex((prev) => {
        const newIndex =
          prev > 0 ? prev - 1 : filteredClipboardHistory.length - 1;
        scrollToClipboardItem(newIndex);
        return newIndex;
      });
    }
  };

  const handleArrowDown = () => {
    if (mode === "apps") {
      setSelectedIndex((prev) =>
        prev < displayedSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (mode === "clipboard") {
      setSelectedIndex((prev) => {
        const newIndex =
          prev < filteredClipboardHistory.length - 1 ? prev + 1 : 0;
        scrollToClipboardItem(newIndex);
        return newIndex;
      });
    }
  };

  const handleEscape = () => {
    // If in clipboard mode and query is not empty, just clear the query
    if (mode === "clipboard" && query) {
      setQuery("");
      setResetTrigger((prev) => prev + 1);
      return;
    }

    // If in clipboard mode with empty query, switch back to apps mode
    if (mode === "clipboard") {
      setMode("apps");
      invoke("resize_window", { width: 750, height: 500 });
      return;
    }

    // Otherwise hide the window
    invoke("hide_window");
  };

  const handleBackToApps = () => {
    setMode("apps");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    // Resize back to original size
    invoke("resize_window", { width: 750, height: 500 });
  };

  // In both openSelectedApp and handleSuggestionClick:
  const openSelectedApp = async () => {
    const selected: any = displayedSuggestions[selectedIndex];
    if (selected?.action) {
      try {
        await selected.action(); // wait for it
        await invoke("hide_window");
        setQuery("");
        setResetTrigger((prev) => prev + 1);
        await fetchRecentApps();
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    if (suggestion?.action) {
      suggestion
        .action()
        .then(async () => {
          invoke("hide_window");
          setQuery("");
          setResetTrigger((prev) => prev + 1);
          await fetchRecentApps();
        })
        .catch(console.error);
    }
  };

  const handleCopyFromHistory = async (text: string) => {
    const success: any = await copyToClipboard(text);
    if (success) {
      // Hide window after copy
      invoke("hide_window");
    }
  };

  // Wrapped clearHistory to handle the bug
  const handleClearHistory = () => {
    isClearing.current = true;
    clearHistory();
    // Reset after a delay to prevent the immediate re-addition
    setTimeout(() => {
      isClearing.current = false;
    }, 2000);
  };

  // Handler for pin success
  const handlePinSuccess = async () => {
    await refreshClipboardHistory();
  };

  // Reset selectedIndex when filtering changes in clipboard mode
  useEffect(() => {
    if (mode === "clipboard") {
      setSelectedIndex(filteredClipboardHistory.length > 0 ? 0 : -1);
    }
  }, [query, mode, filteredClipboardHistory.length]);

  return (
    <div className="flex flex-col w-full h-full rounded-xl overflow-hidden border border-gray-700">
      {/* Command input with back button when in clipboard mode */}
      <CommandInput
        query={query}
        onQueryChange={handleQueryChange}
        onSubmit={handleSubmit}
        onArrowUp={handleArrowUp}
        onArrowDown={handleArrowDown}
        onEscape={handleEscape}
        resetTrigger={resetTrigger}
        showBackButton={mode === "clipboard"}
        onBackClick={handleBackToApps}
      />

      {/* Allow suggestion list to grow and scroll as needed */}
      <div className="flex-grow overflow-hidden">
        {mode === "apps" ? (
          <SuggestionList
            suggestions={displayedSuggestions}
            selectedIndex={selectedIndex}
            onSuggestionClick={handleSuggestionClick}
          />
        ) : (
          <ClipboardHistory
            history={filteredClipboardHistory}
            onCopy={handleCopyFromHistory}
            onDelete={deleteHistoryItem}
            onClear={handleClearHistory}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            onPinSuccess={handlePinSuccess}
          />
        )}
      </div>
    </div>
  );
}

export default App;
