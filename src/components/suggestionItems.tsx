import { useEffect, useRef } from "react";
import { Suggestion } from "../types";

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

  return (
    <div
      className={`flex items-center cursor-pointer px-4 py-3 transition-colors duration-150 rounded-md m-2 ${
        selected ? "bg-gray-900 rounded-md m-2 shadow-lg ring-1 ring-blue-400" : "hover:bg-gray-800"
      }`}
      onClick={onClick}
      ref={ref}
    >
      {suggestion.icon ? (
        <div className="w-5 h-5 mr-3 flex items-center justify-center">
          <img src={suggestion.icon} alt="" className="w-full h-full" />
        </div>
      ) : (
        <div
          className={`w-5 h-5 rounded-full mr-3 ${
            suggestion.iconColor || "bg-blue-500"
          }`}
        ></div>
      )}
      <div className="flex-1">
        <div className="font-normal text-white">{suggestion.title}</div>
        {/* {suggestion.subtitle && (
          <div className="text-xs text-gray-400 mt-0.5">
            {suggestion.subtitle}
          </div>
        )} */}
      </div>

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
    </div>
  );
}
