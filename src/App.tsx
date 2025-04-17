import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { AppInfo, appToSuggestion, Suggestion } from "./types";
import { useSuggestions } from "./hooks/useSuggestion";
import { useClipboardHistory } from "./hooks/useClipboard";
import { ClipboardHistory } from "./components/clipBoard/clipBoardHistory";
import { QuickLinkCreator } from "./components/quickLink/quickLinkCreator";
import { QuickLinkQueryExecutor } from "./components/quickLink/quickLinkQueryExe";
import { listen } from "@tauri-apps/api/event";
import { ManualAppEntry } from "./components/manualAppEntry/ManualAppEntry";

function App() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentApps, setRecentApps] = useState<any>([]);
  const [mode, setMode] = useState<
    "apps" | "clipboard" | "create_quick_link" | "add_manual_app"
  >("apps");
  const [resetTrigger, setResetTrigger] = useState(0);
  const [calculatorResult, setCalculatorResult] = useState<string | null>(null);
  const [showCalculatorCopied, setShowCalculatorCopied] = useState(false);

  // Quick link states - keep popup version for backward compatibility
  const [isQuickLinkCreatorOpen, setIsQuickLinkCreatorOpen] = useState(false);
  const [quickLinkQueryData, setQuickLinkQueryData] = useState<{
    id: string;
    name: string;
    command: string;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemInCategory, setSelectedItemInCategory] = useState(0);

  const isClearing = useRef(false);
  const lastFetchTime = useRef(0);

  const WINDOW_SIZES = {
    apps: { width: 750, height: 500 },
    clipboard: { width: 900, height: 700 },
    create_quick_link: { width: 750, height: 600 },
    add_manual_app: { width: 750, height: 400 },
  };

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

  const resizeWindowForMode = (
    mode: "apps" | "clipboard" | "create_quick_link" | "add_manual_app"
  ) => {
    const size = WINDOW_SIZES[mode];
    invoke("resize_window", { width: size.width, height: size.height });
  };

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

      // Generate suggestions with updated action handlers
      const recentSuggestions = apps.map((app) => ({
        ...appToSuggestion(app),
        action: async () => {
          // Ensure we're opening the correct app by ID
          await invoke("open_app", { appId: app.id });
          return false; // No modal opened
        },
      }));

      // Group recent apps by category
      const categorized = recentSuggestions.reduce<
        Record<string, Suggestion[]>
      >((acc, suggestion: any) => {
        const category = suggestion.category || "Other";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(suggestion);
        return acc;
      }, {});

      // Update state with fresh data - store both flat and categorized data
      setRecentApps({
        flat: recentSuggestions,
        categorized: categorized,
      });
    } catch (error) {
      console.error("Failed to fetch recent apps:", error);
    }
  };

  // Initial setup
  useEffect(() => {
    //set width and height for the windows
    resizeWindowForMode("apps");
    // Force a fresh load of recent apps
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
  }, [calculatorResult, query, mode]);

  // Refresh recent apps when app becomes visible or after reset
  useEffect(() => {
    fetchRecentApps(true);
  }, [resetTrigger]);

  // Intercept search suggestions and enhance their action handlers
  const rawSuggestions: Suggestion[] = useSuggestions(query);

  // Process suggestions to add proper action handling for quick links in search results
  const processedSuggestions = useMemo(() => {
    const processed = rawSuggestions.map((suggestion) => {
      // If this is a quick link from search results, ensure it has the right action handler
      if (suggestion.category === "Quick Links") {
        return {
          ...suggestion,
          action: async () => {
            // Extract the command from the subtitle if available
            const command = suggestion.subtitle || "";

            if (command.includes("{query}")) {
              setQuickLinkQueryData({
                id: suggestion.id,
                name: suggestion.title,
                command: command,
              });
              return true; // Return true to indicate we're showing a modal
            } else {
              // Execute directly using the ID
              await invoke("execute_quick_link", {
                quickLinkId: suggestion.id,
              });
              return false; // No modal opened
            }
          },
        };
      }
      return suggestion;
    });

    // Group suggestions by category
    const categorized = processed.reduce<Record<string, Suggestion[]>>(
      (acc, suggestion: any) => {
        const category = suggestion.category || "Other";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(suggestion);
        return acc;
      },
      {}
    );

    return {
      flat: processed,
      categorized: categorized,
    };
  }, [rawSuggestions]);

  // Handle action for creating quick links
  useEffect(() => {
    const flatSuggestions = processedSuggestions.flat;
    const quickLinkCreator = flatSuggestions.find(
      (s) => s.id === "create_quick_link"
    );
    if (
      quickLinkCreator &&
      selectedIndex === flatSuggestions.indexOf(quickLinkCreator)
    ) {
      const handleCreateQuickLink = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          // Use integrated quick link creator instead of popup
          setMode("create_quick_link");
          resizeWindowForMode("clipboard");
        }
      };

      window.addEventListener("keydown", handleCreateQuickLink);
      return () => {
        window.removeEventListener("keydown", handleCreateQuickLink);
      };
    }
  }, [processedSuggestions, selectedIndex]);

  // Add this effect to handle manual app entry selection via keyboard
  useEffect(() => {
    const flatSuggestions = processedSuggestions.flat;
    const manualAppEntry = flatSuggestions.find(
      (s) => s.id === "add_manual_app"
    );
    if (
      manualAppEntry &&
      selectedIndex === flatSuggestions.indexOf(manualAppEntry)
    ) {
      const handleManualAppEntry = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          // Switch to manual app entry mode
          setMode("add_manual_app");
          resizeWindowForMode("add_manual_app");
        }
      };
      window.addEventListener("keydown", handleManualAppEntry);
      return () => {
        window.removeEventListener("keydown", handleManualAppEntry);
      };
    }
  }, [processedSuggestions, selectedIndex]);

  const displayedSuggestions =
    query.trim() === "" ? recentApps : processedSuggestions;

  useEffect(() => {
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
  }, [displayedSuggestions.categorized]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    // Reset selection when query changes
    if (
      displayedSuggestions.categorized &&
      Object.keys(displayedSuggestions.categorized).length > 0
    ) {
      const firstCategory = Object.keys(displayedSuggestions.categorized)[0];
      setSelectedCategory(firstCategory);
      setSelectedItemInCategory(0);
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
    if (mode === "apps" && displayedSuggestions.flat.length > 0) {
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
      if (!selectedCategory) return;

      const categories = Object.keys(displayedSuggestions.categorized);
      const currentCategoryIndex = categories.indexOf(selectedCategory);
      // const currentItems = displayedSuggestions.categorized[selectedCategory];

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

  const handleEscape = () => {
    if (isQuickLinkCreatorOpen) {
      setIsQuickLinkCreatorOpen(false);
      return;
    }

    if (quickLinkQueryData) {
      setQuickLinkQueryData(null);
      // Focus the command input when closing the query modal
      setTimeout(() => {
        const commandInput = document.getElementById("command-input");
        if (commandInput) {
          (commandInput as HTMLInputElement).focus();
        }
      }, 0);
      return;
    }

    if (mode === "create_quick_link" || mode === "add_manual_app") {
      setMode("apps");
      resizeWindowForMode("apps");
      return;
    }

    if (mode === "clipboard" && query) {
      setQuery("");
      setResetTrigger((prev) => prev + 1);
      return;
    }

    if (mode === "clipboard") {
      setMode("apps");
      resizeWindowForMode("apps");
      return;
    }

    invoke("hide_window");
  };

  // Add a function to handle saving a manual app
  const handleManualAppSave = async () => {
    setMode("apps");
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    resizeWindowForMode("apps");
    // Force refresh recent apps to include the newly added app
    await fetchRecentApps(true);
  };

  const handleBackToApps = () => {
    setMode("apps");
    setQuery("");
    setSelectedIndex(0);
    setResetTrigger((prev) => prev + 1);
    resizeWindowForMode("apps");
  };

  const openSelectedApp = async () => {

    if (!selectedCategory) return;

    // Get the selected app from the categorized data
    const selected =
      displayedSuggestions.categorized[selectedCategory][
        selectedItemInCategory
      ];

    if (selected?.action) {
      try {
        // Execute the action and check if it opens a modal
        const opensModal = await selected.action();

        // Only hide window if not opening a modal
        if (!opensModal) {
          await invoke("hide_window");
          setQuery("");
          setResetTrigger((prev) => prev + 1);
          // Force refresh recent apps for next time
          await fetchRecentApps(true);
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleSuggestionClick = useMemo(() => {
    let isExecuting = false;
    return async (suggestion: any) => {
      if (isExecuting) return;
      isExecuting = true;

      if (suggestion?.action) {
        try {
          const opensModal = await suggestion.action();
          if (!opensModal) {
            await invoke("hide_window");
            setQuery("");
            setResetTrigger((prev) => prev + 1);
            await fetchRecentApps(true);
          }
        } catch (error) {
          console.error(error);
        } finally {
          isExecuting = false;
        }
      }
    };
  }, []);

  const handleCopyFromHistory = async (text: string) => {
    const success = await copyToClipboard(text);
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
    resizeWindowForMode("apps");
  };

  const executeQuickLinkWithQuery = async (finalCommand: string) => {
    if (!quickLinkQueryData) return;

    await invoke("execute_quick_link_with_command", {
      quickLinkId: quickLinkQueryData.id,
      command: finalCommand,
    });

    setQuickLinkQueryData(null);
    setQuery("");
    setResetTrigger((prev) => prev + 1);
    await invoke("hide_window");
  };

  useEffect(() => {
    if (mode === "clipboard") {
      resizeWindowForMode("clipboard");
      setSelectedIndex(filteredClipboardHistory.length > 0 ? 0 : -1);
    } else if (mode === "create_quick_link") {
      resizeWindowForMode("create_quick_link");
    }
  }, [mode, filteredClipboardHistory.length]);

  const refreshSuggestions = async () => {
    setSelectedIndex(0);

    // Always force refresh recent apps for any refresh operation
    await fetchRecentApps(true);

    if (query.trim() !== "") {
      // Then refresh search view if needed
      setQuery((prev) => prev + " ");
    }
  };

  const isMathCalculation = (query: string): boolean => {
    // Check if it matches a unit conversion pattern
    const unitConversionPattern =
      /^\d+(?:\.\d+)?\s*[a-zA-Z°]+\s*to\s*[a-zA-Z°]+$/i;
    if (unitConversionPattern.test(query.trim())) {
      return true;
    }

    // If not a unit conversion, check if it's a math calculation
    // Check if the query contains numeric values and mathematical operators
    const mathPattern = /[\d+\-*/.()\s]+/;

    // Check if query has at least one digit and one operator
    const hasDigit = /\d/.test(query);
    const hasOperator = /[+\-*/]/.test(query);

    // Make sure the query doesn't have other characters
    const hasOnlyMathChars = /^[\d+\-*/.()\s]+$/.test(query);

    return (
      mathPattern.test(query) && hasDigit && hasOperator && hasOnlyMathChars
    );
  };

  const handleCalculatorResult = (result: string | null) => {
    setCalculatorResult(result);
  };

  // Determine if we should show calculator footer
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
        <QuickLinkQueryExecutor
          quickLinkId={quickLinkQueryData.id}
          quickLinkName={quickLinkQueryData.name}
          commandTemplate={quickLinkQueryData.command}
          onClose={() => setQuickLinkQueryData(null)}
          onExecute={executeQuickLinkWithQuery}
        />
      )}

      {/* Calculator Footer */}
      {showCalculatorFooter && (
        <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
          <div className="flex justify-between items-center">
            <div>Calculator</div>
            <div className="flex space-x-3">
              <div className="flex items-center space-x-2">
                <span className="bg-gray-800 px-2 py-1 rounded">↵</span>
                <span>{showCalculatorCopied ? "Copied!" : "Copy Result"}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-gray-800 px-2 py-1 rounded">ESC</span>
                <span>Close</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
