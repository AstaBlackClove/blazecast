import { useEffect, useRef } from "react";
import { Suggestion, ActionType } from "../types";

type Props = {
  suggestion: Suggestion;
  selected: boolean;
  onClick: () => void;
};

export function SuggestionItem({ suggestion, selected, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  // Determine if this is a special action suggestion
  const isQuickLinkCreator = suggestion.id === ActionType.CREATE_QUICK_LINK;

  // Set classes for the icon container based on the suggestion type
  const getIconClasses = () => {
    // Quick link creator gets a special highlight
    if (isQuickLinkCreator) {
      return "w-6 h-6 mr-3 flex items-center justify-center rounded-md text-white";
    }
    // Default icon container
    return "w-5 h-5 mr-3 flex items-center justify-center";
  };

  return (
    <div
      className={`flex items-center cursor-pointer px-4 py-3 transition-colors duration-150 rounded-md m-2 ${
        selected
          ? "bg-gray-900 rounded-md m-2 shadow-lg ring-1 ring-blue-400"
          : "hover:bg-gray-800"
      }`}
      onClick={onClick}
      ref={ref}
    >
      {/* Icon rendering logic */}
      {suggestion.icon ? (
        <div className={getIconClasses()}>
          {/* For emoji icons like 🔗 */}
          {suggestion.icon.length === 1 || suggestion.icon.length === 2 ? (
            <span className="text-lg">{suggestion.icon}</span>
          ) : (
            <img
              src={suggestion.icon}
              alt=""
              className="w-full h-full object-contain"
            />
          )}
        </div>
      ) : (
        <div
          className={`w-5 h-5 rounded-full mr-3 ${suggestion.iconColor}`}
        ></div>
      )}

      <div className="flex-1">
        <div className="font-normal text-white">{suggestion.title}</div>
        {suggestion.subtitle && (
          <div className="text-xs text-gray-400 mt-0.5">
            {suggestion.subtitle}
          </div>
        )}
      </div>

      {/* Category badges */}
      {suggestion.category === "Web Search" && (
        <span className="text-xs text-gray-400 px-2 py-1 rounded bg-gray-700">
          Web
        </span>
      )}
      {suggestion.category === "File Search" && (
        <span className="text-xs text-gray-400 px-2 py-1 rounded bg-gray-700">
          Files
        </span>
      )}
      {suggestion.category === "Actions" && (
        <span className="text-xs text-gray-400 px-2 py-1 rounded bg-gray-700">
          Action
        </span>
      )}
    </div>
  );
}
