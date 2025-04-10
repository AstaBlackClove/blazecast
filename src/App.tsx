import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { AppInfo, appToSuggestion, Suggestion, QuickLink } from "./types";
import { useSuggestions } from "./hooks/useSuggestion";
import { useClipboardHistory } from "./hooks/useClipboard";
import { ClipboardHistory } from "./components/clipBoard/clipBoardHistory";
import { QuickLinkCreator } from "./components/quickLink/quickLinkCreator";
import { QuickLinkQueryExecutor } from "./components/quickLink/quickLinkQueryExe";

function App() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentApps, setRecentApps] = useState<Suggestion[]>([]);
  const [mode, setMode] = useState<"apps" | "clipboard" | "create_quick_link">(
    "apps"
  );
  const [resetTrigger, setResetTrigger] = useState(0);

  // Quick link states - keep popup version for backward compatibility
  const [isQuickLinkCreatorOpen, setIsQuickLinkCreatorOpen] = useState(false);
  const [quickLinkQueryData, setQuickLinkQueryData] = useState<{
    id: string;
    name: string;
    command: string;
  } | null>(null);

  const isClearing = useRef(false);

  const {
    clipboardHistory,
    copyToClipboard,
    clearHistory,
    deleteHistoryItem,
    refreshClipboardHistory,
  } = useClipboardHistory();

  const filteredClipboardHistory =
    mode === "clipboard" && query
      ? clipboardHistory.filter((item: any) =>
          item.text.toLowerCase().includes(query.toLowerCase())
        )
      : clipboardHistory;

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

  // Fetch quick links for recents
  const fetchRecentQuickLinks = async () => {
    try {
      const quickLinks: QuickLink[] = await invoke("get_recent_quick_links");
      const quickLinkSuggestions = quickLinks.map((quickLink) => ({
        id: `${quickLink.id}`,
        title: quickLink.name,
        subtitle: quickLink.description || quickLink.command,
        icon: quickLink.icon,
        category: "Quick Links",
        action: async () => {
          // If command contains {query}, we need to ask for the query value
          if (quickLink.command.includes("{query}")) {
            setQuickLinkQueryData({
              id: quickLink.id,
              name: quickLink.name,
              command: quickLink.command,
            });
          } else {
            // Execute command directly
            await invoke("execute_quick_link", { quickLinkId: quickLink.id });
          }
        },
      }));

      // Combine quick links with app suggestions in recent items
      setRecentApps((prevApps) => [...quickLinkSuggestions, ...prevApps]);
    } catch (error) {
      console.error("Failed to fetch recent quick links:", error);
    }
  };

  useEffect(() => {
    fetchRecentApps();
    fetchRecentQuickLinks();

    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "KeyC") {
        event.preventDefault();
        setMode("clipboard");
        setQuery(""); // clear input
        setResetTrigger((prev) => prev + 1);
        invoke("resize_window", { width: 900, height: 700 });
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => {
      window.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  const suggestions: Suggestion[] = useSuggestions(query);

  // Handle action for creating quick links
  useEffect(() => {
    const quickLinkCreator = suggestions.find(
      (s) => s.id === "create_quick_link"
    );
    if (
      quickLinkCreator &&
      selectedIndex === suggestions.indexOf(quickLinkCreator)
    ) {
      const handleCreateQuickLink = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          // Use integrated quick link creator instead of popup
          setMode("create_quick_link");
          invoke("resize_window", { width: 750, height: 650 });
        }
      };

      window.addEventListener("keydown", handleCreateQuickLink);
      return () => {
        window.removeEventListener("keydown", handleCreateQuickLink);
      };
    }
  }, [suggestions, selectedIndex]);

  const displayedSuggestions = query.trim() === "" ? recentApps : suggestions;

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  const handleSubmit = () => {
    if (mode === "apps" && displayedSuggestions.length > 0) {
      openSelectedApp();
    } else if (mode === "clipboard" && filteredClipboardHistory.length > 0) {
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
    if (isQuickLinkCreatorOpen) {
      setIsQuickLinkCreatorOpen(false);
      return;
    }

    if (quickLinkQueryData) {
      setQuickLinkQueryData(null);
      return;
    }

    if (mode === "create_quick_link") {
      setMode("apps");
      invoke("resize_window", { width: 750, height: 500 });
      return;
    }

    if (mode === "clipboard" && query) {
      setQuery("");
      setResetTrigger((prev) => prev + 1);
      return;
    }

    if (mode === "clipboard") {
      setMode("apps");
      invoke("resize_window", { width: 750, height: 500 });
      return;
    }

    invoke("hide_window");
  };

  const handleBackToApps = () => {
    setMode("apps");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    invoke("resize_window", { width: 750, height: 500 });
  };

  const openSelectedApp = async () => {
    const selected: any = displayedSuggestions[selectedIndex];
    if (selected?.action) {
      try {
        await selected.action();

        // Don't hide window if opening quick link creator or query input
        if (
          selected.id === "create_quick_link" ||
          (selected.id.startsWith("execute_quick_link") &&
            selected?.command?.includes("{query}"))
        ) {
          return;
        }

        await invoke("hide_window");
        setQuery("");
        setResetTrigger((prev) => prev + 1);
        await fetchRecentApps();
        await fetchRecentQuickLinks();
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
          // Don't hide window if opening quick link creator or query input
          if (
            suggestion.id === "create_quick_link" ||
            (suggestion.id.startsWith("execute_quick_link") &&
              suggestion?.command?.includes("{query}"))
          ) {
            return;
          }

          invoke("hide_window");
          setQuery("");
          setResetTrigger((prev) => prev + 1);
          await fetchRecentApps();
          await fetchRecentQuickLinks();
        })
        .catch(console.error);
    }
  };

  const handleCopyFromHistory = async (text: string) => {
    const success: any = await copyToClipboard(text);
    if (success) {
      invoke("hide_window");
    }
  };

  const handleClearHistory = () => {
    isClearing.current = true;
    clearHistory();
    setTimeout(() => {
      isClearing.current = false;
    }, 2000);
  };

  const handlePinSuccess = async () => {
    await refreshClipboardHistory();
  };

  const handleQuickLinkSave = async () => {
    setMode("apps");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    await fetchRecentQuickLinks();
    invoke("resize_window", { width: 750, height: 500 });
  };

  const executeQuickLinkWithQuery = async (finalCommand: string) => {
    if (!quickLinkQueryData) return;

    await invoke("execute_quick_link_with_command", {
      quickLinkId: quickLinkQueryData.id,
      command: finalCommand,
    });

    setQuickLinkQueryData(null);
    await invoke("hide_window");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
  };

  useEffect(() => {
    if (mode === "clipboard") {
      setSelectedIndex(filteredClipboardHistory.length > 0 ? 0 : -1);
    }
  }, [query, mode, filteredClipboardHistory.length]);

  const refreshSuggestions = async () => {
    setSelectedIndex(0);

    if (query.trim() === "") {
      // If user is browsing recents → clear and fetch again
      setRecentApps([]);
      await fetchRecentApps();
      await fetchRecentQuickLinks();
    } else {
      // Always refresh recents after delete too
      setRecentApps([]);
      await fetchRecentApps();
      await fetchRecentQuickLinks();

      // Then refresh search view
      setQuery((prev) => prev + " ");
    }
  };

  return (
    <div className="flex flex-col w-full h-full rounded-xl overflow-hidden border border-gray-700">
      {mode !== "create_quick_link" && (
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
      )}
      <div className="flex-grow overflow-hidden">
        {mode === "apps" ? (
          <SuggestionList
            suggestions={displayedSuggestions}
            selectedIndex={selectedIndex}
            onSuggestionClick={handleSuggestionClick}
            onDeleteQuickLink={refreshSuggestions}
          />
        ) : mode === "clipboard" ? (
          <ClipboardHistory
            history={filteredClipboardHistory}
            onCopy={handleCopyFromHistory}
            onDelete={deleteHistoryItem}
            onClear={handleClearHistory}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            onPinSuccess={handlePinSuccess}
          />
        ) : mode === "create_quick_link" ? (
          <QuickLinkCreator
            onClose={handleBackToApps}
            onSave={handleQuickLinkSave}
          />
        ) : null}
      </div>

      {/* Quick Link Query Executor Modal */}
      {quickLinkQueryData && (
        <QuickLinkQueryExecutor
          quickLinkId={quickLinkQueryData.id}
          quickLinkName={quickLinkQueryData.name}
          commandTemplate={quickLinkQueryData.command}
          onClose={() => setQuickLinkQueryData(null)}
          onExecute={executeQuickLinkWithQuery}
        />
      )}
    </div>
  );
}

export default App;
