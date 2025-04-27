import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { AppInfo } from "./types";
import { ClipboardHistory } from "./components/clipBoard/clipBoardHistory";
import { QuickLinkCreator } from "./components/quickLink/quickLinkCreator";
import { ManualAppEntry } from "./components/manualAppEntry/ManualAppEntry";
import { listen } from "@tauri-apps/api/event";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useClipboardHistory } from "./hooks/useClipboard";
import { useCalculator } from "./hooks/useCalculator";
import { useQuickLinks } from "./hooks/useQuickLinks";
import { useCategorizedSuggestions } from "./hooks/useCategorizedSuggestions";
import { QuickLinkModal } from "./components/quickLink/QuickLinkModalProps";
import { CalculatorFooter } from "./components/calculator/CalculatorFooterProps";

function App() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentApps, setRecentApps] = useState<any>([]);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemInCategory, setSelectedItemInCategory] = useState(0);
  const lastFetchTime = useRef(0);

  const { mode, setMode, resizeWindowForMode, handleBackToApps, handleEscape } =
    useAppNavigation();

  const {
    clipboardHistory,
    copyToClipboard,
    clearHistory,
    copyImageAndHide,
    deleteHistoryItem,
    refreshClipboardHistory,
    getFilteredHistory,
  } = useClipboardHistory();

  const filteredClipboardHistory =
    mode === "clipboard" && query
      ? getFilteredHistory(query)
      : clipboardHistory;

  const {
    calculatorResult,
    showCalculatorCopied,
    setShowCalculatorCopied,
    isMathCalculation,
    handleCalculatorResult,
  } = useCalculator();

  const {
    quickLinkQueryData,
    setQuickLinkQueryData,
    executeQuickLinkWithQuery,
  } = useQuickLinks(setQuery);

  // Fetch recent apps function
  const fetchRecentApps = async (force = false) => {
    try {
      // Throttle fetches to avoid hammering backend
      const now = Date.now();
      if (!force && now - lastFetchTime.current < 500) {
        return; // Skip if fetched too recently
      }

      lastFetchTime.current = now;

      // Always fetch fresh data from backend
      const apps: AppInfo[] = await invoke("get_recent_apps");
      const processedApps = await useCategorizedSuggestions.processRecentApps(
        apps
      );
      setRecentApps(processedApps);
    } catch (error) {
      console.error("Failed to fetch recent apps:", error);
    }
  };

  // Process suggestions
  const processedSuggestions = useCategorizedSuggestions.processSuggestions(
    query,
    setQuickLinkQueryData
  );

  // Initial setup
  useEffect(() => {
    resizeWindowForMode("apps");
    fetchRecentApps(true);

    const handleShortcut = (event: KeyboardEvent) => {
      if (event.altKey && event.shiftKey && event.code === "KeyC") {
        event.preventDefault();
        setMode("clipboard");
        setQuery("");
        setResetTrigger((prev) => prev + 1);
        resizeWindowForMode("clipboard");
      }
    };

    // Listen for the Tauri event to switch to clipboard mode
    const unlisten = listen("switch-to-clipboard", () => {
      setMode("clipboard");
      setQuery("");
      setResetTrigger((prev) => prev + 1);
      resizeWindowForMode("clipboard");
    });

    window.addEventListener("keydown", handleShortcut);

    // Add focus event listener to refresh recent apps when window gains focus
    const handleFocus = () => fetchRecentApps(true);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("keydown", handleShortcut);
      window.removeEventListener("focus", handleFocus);
      unlisten.then((unlistenFn) => unlistenFn());
    };
  }, []);

  // Handle Enter key press for calculator copy
  useEffect(() => {
    const handleEnterKeyForCalculator = (event: KeyboardEvent) => {
      if (
        event.key === "Enter" &&
        mode === "apps" &&
        isMathCalculation(query) &&
        calculatorResult
      ) {
        event.preventDefault();
        copyToClipboard(calculatorResult);
        setShowCalculatorCopied(true);

        // Hide the copied message after 2 seconds
        setTimeout(() => {
          setShowCalculatorCopied(false);
        }, 2000);
      }
    };

    window.addEventListener("keydown", handleEnterKeyForCalculator);
    return () => {
      window.removeEventListener("keydown", handleEnterKeyForCalculator);
    };
  }, [calculatorResult, query, mode, isMathCalculation, copyToClipboard]);

  // Refresh recent apps when app becomes visible or after reset
  useEffect(() => {
    fetchRecentApps(true);
  }, [resetTrigger]);

  // Update selection when suggestions change
  useEffect(() => {
    const displayedSuggestions =
      query.trim() === "" ? recentApps : processedSuggestions;

    if (
      displayedSuggestions.categorized &&
      Object.keys(displayedSuggestions.categorized).length > 0
    ) {
      const firstCategory = Object.keys(displayedSuggestions.categorized)[0];
      setSelectedCategory(firstCategory);
      setSelectedItemInCategory(0);
    } else {
      setSelectedCategory(null);
      setSelectedItemInCategory(0);
    }
  }, [processedSuggestions, recentApps, query]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    // Reset selection when query changes
    const displayedSuggestions =
      newQuery.trim() === "" ? recentApps : processedSuggestions;
    if (
      displayedSuggestions.categorized &&
      Object.keys(displayedSuggestions.categorized).length > 0
    ) {
      const firstCategory = Object.keys(displayedSuggestions.categorized)[0];
      setSelectedCategory(firstCategory);
      setSelectedItemInCategory(0);
    }
  };

  const handleArrowUp = () => {
    if (mode === "apps") {
      if (!selectedCategory) return;

      const displayedSuggestions =
        query.trim() === "" ? recentApps : processedSuggestions;
      const categories = Object.keys(displayedSuggestions.categorized);
      const currentCategoryIndex = categories.indexOf(selectedCategory);

      if (selectedItemInCategory > 0) {
        // Move up within current category
        setSelectedItemInCategory((prev) => prev - 1);
      } else if (currentCategoryIndex > 0) {
        // Move to previous category, select last item
        const prevCategory = categories[currentCategoryIndex - 1];
        const prevCategoryItems =
          displayedSuggestions.categorized[prevCategory];
        setSelectedCategory(prevCategory);
        setSelectedItemInCategory(prevCategoryItems.length - 1);
      } else {
        // Wrap to last category, last item
        const lastCategory = categories[categories.length - 1];
        const lastCategoryItems =
          displayedSuggestions.categorized[lastCategory];
        setSelectedCategory(lastCategory);
        setSelectedItemInCategory(lastCategoryItems.length - 1);
      }
    } else if (mode === "clipboard") {
      // Keep existing clipboard navigation logic
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
      if (!selectedCategory) return;

      const displayedSuggestions =
        query.trim() === "" ? recentApps : processedSuggestions;
      const categories = Object.keys(displayedSuggestions.categorized);
      const currentCategoryIndex = categories.indexOf(selectedCategory);
      const currentItems = displayedSuggestions.categorized[selectedCategory];

      if (selectedItemInCategory < currentItems.length - 1) {
        // Move down within current category
        setSelectedItemInCategory((prev) => prev + 1);
      } else if (currentCategoryIndex < categories.length - 1) {
        // Move to next category, select first item
        const nextCategory = categories[currentCategoryIndex + 1];
        setSelectedCategory(nextCategory);
        setSelectedItemInCategory(0);
      } else {
        // Wrap to first category, first item
        const firstCategory = categories[0];
        setSelectedCategory(firstCategory);
        setSelectedItemInCategory(0);
      }
    } else if (mode === "clipboard") {
      // Keep existing clipboard navigation logic
      setSelectedIndex((prev) => {
        const newIndex =
          prev < filteredClipboardHistory.length - 1 ? prev + 1 : 0;
        scrollToClipboardItem(newIndex);
        return newIndex;
      });
    }
  };

  const scrollToClipboardItem = (index: number) => {
    const item = document.getElementById(`clipboard-item-${index}`);
    if (item) {
      item.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  };

  const handleSubmit = async () => {
    // Check if calculator is showing and we have a result to copy
    if (mode === "apps" && isMathCalculation(query) && calculatorResult) {
      await copyToClipboard(calculatorResult);
      setShowCalculatorCopied(true);

      // Hide the copied message after 2 seconds
      setTimeout(() => {
        setShowCalculatorCopied(false);
      }, 2000);

      return;
    }

    // Handle normal behavior
    if (mode === "apps" && selectedCategory) {
      // For apps mode, use the categorized structure
      const selectedItem =
        displayedSuggestions.categorized[selectedCategory][
          selectedItemInCategory
        ];

      if (selectedItem) {
        // Special cases
        if (selectedItem.id === "create_quick_link") {
          setMode("create_quick_link");
          resizeWindowForMode("create_quick_link");
          return;
        }

        if (selectedItem.id === "add_manual_app") {
          setMode("add_manual_app");
          resizeWindowForMode("add_manual_app");
          return;
        }

        // Regular action
        if (selectedItem.action) {
          const opensModal = await selectedItem.action();
          if (!opensModal) {
            await invoke("hide_window");
            setQuery("");
            setResetTrigger((prev) => prev + 1);
            await fetchRecentApps(true);
          }
        }
      }
    } else if (mode === "clipboard" && filteredClipboardHistory.length > 0) {
      const selectedItem = filteredClipboardHistory[selectedIndex];
      if (selectedItem.type === "text") {
        handleCopyFromHistory(selectedItem.text);
      } else if (selectedItem.type === "image") {
        // Directly handle image copy for Enter press
        await copyImageAndHide(selectedItem.imageData.filePath);
      }
    }
  };

  const handleCopyFromHistory = async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      invoke("hide_window");
    }
  };

  const handleSuggestionClick = useMemo(() => {
    let isExecuting = false;
    return async (suggestion: any) => {
      if (isExecuting) return;
      isExecuting = true;

      try {
        // Special handling for create quick link
        if (suggestion.id === "create_quick_link") {
          setMode("create_quick_link");
          resizeWindowForMode("create_quick_link");
          isExecuting = false;
          return;
        }

        // Special handling for add manual app
        if (suggestion.id === "add_manual_app") {
          setMode("add_manual_app");
          resizeWindowForMode("add_manual_app");
          isExecuting = false;
          return;
        }

        // Normal action handling for other suggestions
        if (suggestion?.action) {
          const opensModal = await suggestion.action();
          if (!opensModal) {
            await invoke("hide_window");
            setQuery("");
            setResetTrigger((prev) => prev + 1);
            await fetchRecentApps(true);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        isExecuting = false;
      }
    };
  }, [setMode, resizeWindowForMode]);

  const handleClearHistory = () => {
    clearHistory();
  };

  const handlePinSuccess = async () => {
    await refreshClipboardHistory();
  };

  const handleQuickLinkSave = async () => {
    setMode("apps");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    resizeWindowForMode("apps");
  };

  const handleManualAppSave = async () => {
    setMode("apps");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    resizeWindowForMode("apps");
    // Force refresh recent apps to include the newly added app
    await fetchRecentApps(true);
  };

  const refreshSuggestions = async () => {
    setSelectedIndex(0);
    await fetchRecentApps(true);
    if (query.trim() !== "") {
      // Then refresh search view if needed
      setQuery((prev) => prev + " ");
    }
  };

  // UI rendering logic
  const displayedSuggestions =
    query.trim() === "" ? recentApps : processedSuggestions;
  const showCalculatorFooter =
    mode === "apps" && isMathCalculation(query) && calculatorResult;

  return (
    <div className="flex flex-col w-full h-full rounded-xl overflow-hidden border border-gray-700">
      {mode !== "create_quick_link" && mode !== "add_manual_app" && (
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
            suggestions={displayedSuggestions.flat}
            groupedSuggestions={displayedSuggestions.categorized}
            selectedIndex={selectedIndex} // Keep for backward compatibility
            selectedCategory={selectedCategory}
            selectedItemInCategory={selectedItemInCategory}
            onSuggestionClick={handleSuggestionClick}
            onDeleteQuickLink={refreshSuggestions}
            showFooter={!showCalculatorFooter}
            query={query}
            isMathCalculation={isMathCalculation}
            onResultAvailable={handleCalculatorResult}
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
        ) : mode === "add_manual_app" ? (
          <ManualAppEntry
            onClose={handleBackToApps}
            onSave={handleManualAppSave}
          />
        ) : null}
      </div>

      {/* Quick Link Query Executor Modal */}
      {quickLinkQueryData && (
        <QuickLinkModal
          quickLinkData={quickLinkQueryData}
          onClose={() => setQuickLinkQueryData(null)}
          onExecute={executeQuickLinkWithQuery}
        />
      )}

      {/* Calculator Footer */}
      {showCalculatorFooter && (
        <CalculatorFooter showCopied={showCalculatorCopied} />
      )}
    </div>
  );
}

export default App;
