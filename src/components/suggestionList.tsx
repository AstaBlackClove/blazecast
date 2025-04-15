import { useEffect, useState } from "react";
import { Suggestion } from "../types";
import { SuggestionItem } from "./suggestionItems";
import { invoke } from "@tauri-apps/api/tauri";
import { Calculator } from "./calculator/calculator";

type Props = {
  suggestions: Suggestion[];
  selectedIndex: number;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onDeleteQuickLink?: () => void;
  showFooter?: boolean;
  query?: string;
  isMathCalculation?: (query: string) => boolean;
  onResultAvailable?: (result: string | null) => void;
};

type IndexStatus = {
  building: boolean;
};

export function SuggestionList({
  suggestions,
  selectedIndex,
  onSuggestionClick,
  onDeleteQuickLink,
  showFooter = true,
  query = "",
  isMathCalculation = () => false,
  onResultAvailable = () => {},
}: Props) {
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);
  const isCalculatorQuery = query ? isMathCalculation(query) : false;

  // Check if app index is being built initially
  useEffect(() => {
    const checkIndexStatus = async () => {
      // You would need to implement this API endpoint
      try {
        const status = await invoke<IndexStatus>("get_index_status");
        setIsIndexBuilding(status.building);

        if (status.building) {
          // Check again in 2 seconds
          setTimeout(checkIndexStatus, 2000);
        }
      } catch (error) {
        console.error("Failed to check index status:", error);
      }
    };

    checkIndexStatus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === "d") {
        if (isSelectedQuickLink()) {
          e.preventDefault();

          const selectedSuggestion = suggestions[selectedIndex];
          if (selectedSuggestion) {
            invoke("delete_quick_link", { quickLinkId: selectedSuggestion.id })
              .then(() => {
                if (onDeleteQuickLink) {
                  onDeleteQuickLink();
                }
              })
              .catch((error) => {
                console.error("Failed to delete quick link:", error);
              });
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [suggestions, selectedIndex]);

  // Group suggestions by category
  const groupedSuggestions = suggestions.reduce<Record<string, Suggestion[]>>(
    (acc, suggestion) => {
      const category = suggestion.category || "Other";
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(suggestion);
      return acc;
    },
    {}
  );

  const isEmpty = suggestions.length === 0;

  // Function to get the actual index in the flat array
  const getAbsoluteIndex = (
    categoryIndex: number,
    itemIndex: number
  ): number => {
    let absoluteIndex = 0;
    const categories = Object.keys(groupedSuggestions);
    for (let i = 0; i < categoryIndex; i++) {
      absoluteIndex += groupedSuggestions[categories[i]].length;
    }

    return absoluteIndex + itemIndex;
  };

  if (isIndexBuilding) {
    return (
      <div className="text-center text-gray-400 p-4">
        Building app index... 🔄
      </div>
    );
  }

  const isSelectedQuickLink = () => {
    const selectedSuggestion = suggestions[selectedIndex];
    return selectedSuggestion?.category === "Quick Links";
  };

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Calculator section - now inside SuggestionList */}
      {isCalculatorQuery && (
        <div className="flex-shrink-0">
          <Calculator query={query} onResultAvailable={onResultAvailable} />
        </div>
      )}

      {/* Main scrollable area that takes available height */}
      <div className="flex-grow overflow-y-auto">
        {isIndexBuilding ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-2"></div>
              Building app index...
            </div>
          </div>
        ) : isEmpty ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-gray-500 text-center py-8">
              No matching results
            </div>
          </div>
        ) : (
          <div>
            {Object.entries(groupedSuggestions).map(
              ([category, items], categoryIndex) => (
                <div key={categoryIndex}>
                  <div className="text-xs text-gray-400 px-4 py-2 uppercase tracking-wide">
                    {category}
                  </div>
                  {items.map((suggestion, itemIndex) => {
                    const absoluteIndex = getAbsoluteIndex(
                      categoryIndex,
                      itemIndex
                    );
                    return (
                      <SuggestionItem
                        key={suggestion.id}
                        suggestion={suggestion}
                        selected={selectedIndex === absoluteIndex}
                        onClick={() => onSuggestionClick(suggestion)}
                      />
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}
      </div>
      {showFooter && suggestions.length > 0 && (
        <div className="flex-shrink-0 bg-gray-700 border-t border-gray-800 px-4 py-2 text-xs text-gray-400">
          <div className="flex justify-between items-center">
            <div>Actions</div>
            <div className="flex space-x-3">
              <div className="flex items-center space-x-2">
                <span className="bg-gray-800 px-2 py-1 rounded">↵</span>
                <span>Open</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-gray-800 px-2 py-1 rounded">
                  ALT + SHFT + C
                </span>
                <span>Clipboard</span>
              </div>
              {isSelectedQuickLink() && (
                <div className="flex items-center space-x-2">
                  <span className="bg-gray-800 px-2 py-1 rounded">
                    SHFT + D
                  </span>
                  <span>Delete Quick Link</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
