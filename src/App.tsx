import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { AppInfo, appToSuggestion, Suggestion } from "./types";
import { useSuggestions } from "./hooks/useSuggestion";

function App() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentApps, setRecentApps] = useState<Suggestion[]>([]);

  // Load recent apps when the app starts
  useEffect(() => {
    const fetchRecentApps = async () => {
      try {
        // 1. Fetch AppInfo array from backend
        const apps: AppInfo[] = await invoke("get_recent_apps");
        // 2. Convert to Suggestion with proper action
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

    fetchRecentApps();
  }, []);

  // Use the useSuggestions hook to fetch suggestions
  const suggestions: Suggestion[] = useSuggestions(query);

  // If query is empty, show recent apps
  const displayedSuggestions = query.trim() === "" ? recentApps : suggestions;

  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  const handleSubmit = () => {
    if (displayedSuggestions.length > 0) {
      openSelectedApp();
    }
  };

  const handleArrowUp = () => {
    setSelectedIndex((prev) =>
      prev > 0 ? prev - 1 : displayedSuggestions.length - 1
    );
  };

  const handleArrowDown = () => {
    setSelectedIndex((prev) =>
      prev < displayedSuggestions.length - 1 ? prev + 1 : 0
    );
  };

  const handleEscape = () => {
    // Hide the window
    invoke("hide_window");
  };

  // In both openSelectedApp and handleSuggestionClick:
  const openSelectedApp = () => {
    const selected: any = displayedSuggestions[selectedIndex];
    console.log(selected)
    if (selected?.action) {
      selected
        .action()
        .then(() => {
          invoke("hide_window");
          setQuery("");
        })
        .catch(console.error);
    }
  };

  const handleSuggestionClick = (suggestion: any) => {
    if (suggestion?.action) {
      suggestion
        .action() // Execute the pre-defined action
        .then(() => {
          invoke("hide_window");
          setQuery("");
        })
        .catch(console.error);
    }
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
        />
      </div>

      {/* Allow suggestion list to grow and scroll as needed */}
      <div className="flex-grow overflow-hidden">
        <SuggestionList
          suggestions={displayedSuggestions}
          selectedIndex={selectedIndex}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>
    </div>
  );
}

export default App;
