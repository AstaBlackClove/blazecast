import { useState, useEffect } from "react";

interface QuickLinkExecutorProps {
  quickLinkId: string;
  quickLinkName: string;
  commandTemplate: string;
  onClose: () => void;
  onExecute: (finalCommand: string) => Promise<void>;
}

export function QuickLinkQueryExecutor({
  //   quickLinkId,
  // quickLinkName,
  commandTemplate,
  onClose,
  onExecute,
}: QuickLinkExecutorProps) {
  const [queryValue, setQueryValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Extract the placeholder parts to show what will be replaced
  const parts = commandTemplate.split("{query}");
  const preQueryPart = parts[0];
  const postQueryPart = parts.length > 1 ? parts[1] : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!queryValue.trim() && commandTemplate.includes("{query}")) {
      setError("Please enter a value for the query");
      return;
    }

    // Replace {query} with the actual value
    const finalCommand = commandTemplate.replace("{query}", queryValue);

    try {
      await onExecute(finalCommand);
      onClose();
    } catch (err) {
      setError(`Failed to execute command: ${err}`);
    }
  };

  useEffect(() => {
    // Focus on the query input when component mounts
    const queryInput = document.getElementById("quick-link-query-input");
    if (queryInput) {
      queryInput.focus();
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div
        className="bg-gray-800 rounded-lg w-full max-w-md p-6 shadow-xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="quick-link-query-input"
              className="block text-sm text-gray-400 mb-2"
            >
              Enter value for {"{query}"}
            </label>
            <input
              id="quick-link-query-input"
              type="text"
              value={queryValue}
              onChange={(e) => setQueryValue(e.target.value)}
              className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Parameter value"
            />
          </div>

          <div className="bg-gray-900 p-3 rounded">
            <div className="text-sm text-gray-400 mb-1">Command Preview:</div>
            <div className="font-mono text-white break-all">
              {preQueryPart}
              <span className="text-yellow-400">{queryValue || "{query}"}</span>
              {postQueryPart}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
