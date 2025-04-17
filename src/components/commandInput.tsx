import { useEffect, useRef } from "react";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onEscape: () => void;
  resetTrigger?: number;
  showBackButton?: boolean;
  onBackClick?: () => void;
};

export function CommandInput({
  query,
  onQueryChange,
  onSubmit,
  onArrowUp,
  onArrowDown,
  onEscape,
  resetTrigger = 0,
  showBackButton = false,
  onBackClick,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset input when resetTrigger changes
  useEffect(() => {
    if (resetTrigger > 0) {
      onQueryChange("");
    }
  }, [resetTrigger]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onArrowDown();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onArrowUp();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
    }
  };

  // Add this useEffect to handle focus
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [resetTrigger]);

  // Clear the input when the window is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onQueryChange("");
      } else if (inputRef.current) {
        inputRef.current.focus(); // Focus when app becomes visible
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onQueryChange]);

  return (
    <div className="flex items-center bg-gray-700 px-3 py-2">
      {showBackButton && (
        <div
          className="text-gray-400 hover:text-white cursor-pointer mr-2"
          onClick={onBackClick}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </div>
      )}
      <input
        ref={inputRef}
        id="command-input"
        autoFocus
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder={
          showBackButton
            ? "Clipboard history..."
            : "Search for apps and commands or type 'quick' for quick link creation..."
        }
        className="w-full p-3 rounded-xl bg-white/5 backdrop-blur-none text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all duration-300 ease-in-out focus:bg-white/10 focus:backdrop-blur-md"
      />
    </div>
  );
}
