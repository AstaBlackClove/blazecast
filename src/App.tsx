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
  const openSelectedApp = async () => {
    const selected: any = displayedSuggestions[selectedIndex];
    if (selected?.action) {
      try {
        await selected.action(); // wait for it
        await invoke("hide_window");
        setQuery("");
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
          await fetchRecentApps();
        })
        .catch(console.error);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-black/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      {/* Make command input fixed at top with flex-shrink-0 */}
      <div className="flex-shrink-0">
        <CommandInput
          query={query}
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
