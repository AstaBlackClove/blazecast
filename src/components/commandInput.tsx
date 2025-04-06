import { useEffect } from "react";
// import { ArrowLeft } from "lucide-react";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  onArrowUp: () => void;
  onArrowDown: () => void;
  onEscape: () => void;
  resetTrigger?: number;
};

export function CommandInput({
  query,
  onQueryChange,
  onSubmit,
  onArrowUp,
  onArrowDown,
  onEscape,
  resetTrigger = 0,
}: Props) {
  // Reset input when resetTrigger changes
  useEffect(() => {
    if (resetTrigger > 0) {
      query = "";
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

  // Clear the input when the window is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        query = "";
        onQueryChange("");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onQueryChange]);

  return (
    <div className="flex items-center border-b border-gray-800 px-3 py-2">
      {/* <div className="text-gray-500 mr-2">
        <ArrowLeft size={16} />
      </div> */}
      <input
        autoFocus
        type="text"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search for apps and commands..."
        className="w-full p-3 rounded-xl bg-white/5 backdrop-blur-none text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all duration-300 ease-in-out focus:bg-white/10 focus:backdrop-blur-md"
      />
    </div>
  );
}
