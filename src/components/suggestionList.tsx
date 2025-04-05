import { Suggestion } from "../types";
import { SuggestionItem } from "./suggestionItems";

type Props = {
  suggestions: Suggestion[];
  selectedIndex: number;
  onSuggestionClick: (suggestion: Suggestion) => void;
};

export function SuggestionList({
  suggestions,
  selectedIndex,
  onSuggestionClick,
}: Props) {
  const today = suggestions.filter(
    (s) => s.category === "Today" || !s.category
  );
  const other = suggestions.filter((s) => s.category && s.category !== "Today");
  const isEmpty = suggestions.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Main scrollable area that takes available height */}
      <div className="flex-grow overflow-y-auto">
        {isEmpty ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 text-center py-8">
              No matching results
            </div>
          </div>
        ) : (
          <div>
            {today.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 px-4 py-2 uppercase tracking-wide">
                  Today
                </div>
                {today.map((suggestion, index) => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    selected={selectedIndex === index}
                    onClick={() => onSuggestionClick(suggestion)}
                  />
                ))}
              </div>
            )}
            {other.length > 0 &&
              other.map((category, categoryIndex) => (
                <div key={categoryIndex}>
                  <div className="text-xs text-gray-500 px-4 py-2 uppercase tracking-wide">
                    {category.category}
                  </div>
                  <SuggestionItem
                    suggestion={category}
                    selected={selectedIndex === today.length + categoryIndex}
                    onClick={() => onSuggestionClick(category)}
                  />
                </div>
              ))}
          </div>
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
          <div className="flex justify-between items-center">
            <div>Actions</div>
            <div className="flex items-center space-x-2">
              <span className="bg-gray-800 px-2 py-1 rounded">↵</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
