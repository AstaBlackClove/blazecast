import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { Suggestion } from "./types";
import { appToSuggestion, AppInfo } from "./types";

function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<AppInfo[]>([]);
  const [recentApps, setRecentApps] = useState<AppInfo[]>([]);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const [resetInputTrigger, setResetInputTrigger] = useState(0);

  // Load recent apps for reference, but don't display them initially
  useEffect(() => {
    const fetchRecentApps = async () => {
      try {
        const apps = await invoke<AppInfo[]>("get_recent_apps");
        setRecentApps(apps);
        // Don't set suggestions here
      } catch (error) {
        console.error("Failed to fetch recent apps:", error);
      }
    };

    fetchRecentApps();
  }, []);

  // Search for apps when query changes
  useEffect(() => {
    const searchApps = async () => {
      if (query.trim() === "") {
        // Clear suggestions if query is empty
        setSuggestions([]);
        setSelectedIndex(0);
        setHasStartedTyping(false);
        return;
      }

      // User has started typing
      setHasStartedTyping(true);

      try {
        const results = await invoke<AppInfo[]>("search_apps", { query });
        setSearchResults(results);

        // Convert to suggestions
        const suggestions = results.map(appToSuggestion);
        setSuggestions(suggestions);
        setSelectedIndex(0);
      } catch (error) {
        console.error("Failed to search apps:", error);
      }
    };

    // Debounce search to avoid too many requests
    const timer = setTimeout(() => {
      searchApps();
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  const handleSubmit = () => {
    if (suggestions.length > 0) {
      openSelectedApp();
    }
  };

  const handleArrowUp = () => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
  };

  const handleArrowDown = () => {
    setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
  };

  const handleEscape = () => {
    // Hide the window
    invoke("hide_window");
  };

  const openSelectedApp = () => {
    const selected = suggestions[selectedIndex];
    if (selected) {
      invoke("open_app", { appId: selected.id })
        .then(() => {
          // Hide the window after launching the app
          invoke("hide_window");
          // Clear the search
          setQuery("");
          // Trigger input reset
          setResetInputTrigger(prev => prev + 1);
        })
        .catch((error) => {
          console.error("Failed to open app:", error);
        });
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    invoke("open_app", { appId: suggestion.id })
      .then(() => {
        // Hide the window after launching the app
        invoke("hide_window");
        // Clear the search
        setQuery("");
      })
      .catch((error) => {
        console.error("Failed to open app:", error);
      });
  };

  return (
    <div className="flex flex-col w-full h-full bg-black/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      {/* Make command input fixed at top with flex-shrink-0 */}
      <div className="flex-shrink-0">
        <CommandInput
          onQueryChange={handleQueryChange}
          onSubmit={handleSubmit}
          onArrowUp={handleArrowUp}
          onArrowDown={handleArrowDown}
          onEscape={handleEscape}
          resetTrigger={resetInputTrigger}
        />
      </div>

      {/* Allow suggestion list to grow and scroll as needed */}
      <div className="flex-grow overflow-hidden">
        <SuggestionList
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSuggestionClick={handleSuggestionClick}
          isTyping={hasStartedTyping}
        />
      </div>
    </div>
  );
}

export default App;
