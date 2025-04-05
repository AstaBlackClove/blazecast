import { useState } from "react";
import { appWindow } from "@tauri-apps/api/window";
import { useSuggestions } from "./hooks/useSuggestion";
import { CommandInput } from "./components/commandInput";
import { SuggestionList } from "./components/suggestionList";
import { Suggestion } from "./types";

function App() {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestions = useSuggestions(query);

  const handleSubmit = () => {
    if (suggestions.length > 0) {
      suggestions[selectedIndex].action();
      setQuery("");
      appWindow.hide();
    }
  };

  const handleArrowUp = () => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
  };

  const handleArrowDown = () => {
    setSelectedIndex((prev) =>
      prev < suggestions.length - 1 ? prev + 1 : prev
    );
  };

  const handleEscape = () => {
    appWindow.hide();
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    suggestion.action();
    setQuery("");
    appWindow.hide();
  };

  return (
    <div className="flex flex-col w-full h-full bg-black/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      {/* Make command input fixed at top with flex-shrink-0 */}
      <div className="flex-shrink-0">
        <CommandInput
          onQueryChange={(q) => {
            setQuery(q);
            setSelectedIndex(0); // Reset selection when query changes
          }}
          onSubmit={handleSubmit}
          onArrowUp={handleArrowUp}
          onArrowDown={handleArrowDown}
          onEscape={handleEscape}
        />
      </div>

      {/* Allow suggestion list to grow and scroll as needed */}
      <div className="flex-grow overflow-hidden">
        <SuggestionList
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSuggestionClick={handleSuggestionClick}
        />
      </div>
    </div>
  );
}

export default App;
