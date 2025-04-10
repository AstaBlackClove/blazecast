import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";

interface IntegratedQuickLinkCreatorProps {
  onClose: () => void;
  onSave?: () => void;
}

// const DEFAULT_ICONS = [
//   "🔗",
//   "📝",
//   "🌐",
//   "📋",
//   "⚙️",
//   "🖥️",
//   "📁",
//   "📊",
//   "⚡",
//   "🚀",
//   "💻",
//   "🔧",
//   "🔍",
//   "📈",
//   "🔄",
//   "🔒",
// ];

export function QuickLinkCreator({
  onClose,
  onSave,
}: IntegratedQuickLinkCreatorProps) {
  const [formData, setFormData] = useState({
    name: "",
    command: "",
    icon: "🔗",
    open_with: "browser" as "terminal" | "browser" | "app",
    description: "",
  });

  const [error, setError] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  //   const handleIconSelect = (icon: string) => {
  //     setFormData((prev) => ({ ...prev, icon }));
  //   };

  const insertQueryPlaceholder = () => {
    setFormData((prev) => ({
      ...prev,
      command: prev.command.includes("{query}")
        ? prev.command
        : prev.command + "{query}",
    }));
  };

  const saveQuickLink = async () => {
    if (!formData.name || !formData.command) {
      setError("Name and command are required");
      return;
    }

    try {
      await invoke("save_quick_link", { quickLink: formData });
      if (onSave) {
        onSave();
      } else {
        onClose();
      }
    } catch (err) {
      setError(`Failed to save quick link: ${err}`);
    }
  };

  useEffect(() => {
    // Focus on the name input when component mounts
    const nameInput = document.getElementById("quick-link-name");
    if (nameInput) {
      nameInput.focus();
    }
  }, []);

  return (
    <div className="flex flex-col w-full p-4 bg-gray-800 rounded-xl">
      <div className="flex items-center mb-6">
        <button onClick={onClose} className="p-2 mr-3 bg-gray-700 rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-medium text-white">Create Quick Link</h2>
      </div>

      {error && (
        <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col mb-4">
          <label className="text-gray-400 mb-2">Organization</label>
          <div className="relative">
            <select
              className="w-full appearance-none bg-gray-700 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue="None"
            >
              <option>None</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-col mb-4">
          <label htmlFor="quick-link-name" className="text-gray-400 mb-2">
            Name
          </label>
          <input
            id="quick-link-name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className="bg-gray-700 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search Twitter"
          />
        </div>

        <div className="flex flex-col mb-4">
          <label htmlFor="quick-link-command" className="text-gray-400 mb-2">
            Link
          </label>
          <div className="flex">
            <input
              id="quick-link-command"
              name="command"
              type="text"
              value={formData.command}
              onChange={handleChange}
              className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.twitter.com/search?q={query}"
            />
            <button
              onClick={() => {}}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-r-md border-l border-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>
          </div>

          <div className="mt-2 text-sm text-gray-400">
            Include an argument by inserting {"{query}"} in the URL. The word
            "query" can be changed to anything and will be used as the
            placeholder text. Enter up to 3 arguments.
          </div>

          <button
            onClick={insertQueryPlaceholder}
            className="mt-2 text-blue-400 hover:text-blue-300 text-sm self-start"
          >
            Insert {"{query}"} placeholder
          </button>
        </div>

        <div className="flex flex-col mb-4">
          <label htmlFor="quick-link-open-with" className="text-gray-400 mb-2">
            Open With
          </label>
          <div className="relative">
            <select
              id="quick-link-open-with"
              name="open_with"
              value={formData.open_with}
              onChange={handleChange}
              className="w-full appearance-none bg-gray-700 text-white px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="browser">Browser (Default)</option>
              <option value="terminal">Terminal</option>
              <option value="app">Application</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={onClose}
          className="mr-2 px-4 py-2 bg-transparent text-white hover:bg-gray-700 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={saveQuickLink}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md flex items-center"
        >
          Create Quicklink
        </button>
      </div>
    </div>
  );
}
