import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";

interface IntegratedQuickLinkCreatorProps {
  onClose: () => void;
  onSave?: () => void;
}

interface OpenWithSuggestion {
  id: string;
  name: string;
  icon: string;
  is_default: boolean;
}

export function QuickLinkCreator({
  onClose,
  onSave,
}: IntegratedQuickLinkCreatorProps) {
  const [formData, setFormData] = useState({
    name: "",
    command: "",
    icon: "🔗",
    open_with: "browser",
    description: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isFormValid, setIsFormValid] = useState(false);

  const [openWithSuggestions, setOpenWithSuggestions] = useState<
    OpenWithSuggestion[]
  >([]);

  // Check form validity whenever name or command changes
  useEffect(() => {
    setIsFormValid(
      formData.name.trim() !== "" && formData.command.trim() !== ""
    );
  }, [formData.name, formData.command]);

  useEffect(() => {
    const fetchOpenWithSuggestions = async () => {
      let suggestions: OpenWithSuggestion[] = [
        {
          id: "browser",
          name: "Browser (Loading...)",
          icon: "🌐",
          is_default: true,
        },
        { id: "terminal", name: "Terminal", icon: "⚡", is_default: false },
      ];

      // Set these initial suggestions right away
      setOpenWithSuggestions(suggestions);

      // Try to get the default browser first
      try {
        const defaultBrowser = await invoke<string>("get_default_browser");
        if (defaultBrowser) {
          // Update the browser entry with the actual browser name
          suggestions = suggestions.map((sugg) =>
            sugg.id === "browser"
              ? { ...sugg, name: `${defaultBrowser} (Default)` }
              : sugg
          );

          // Update the state with the browser info
          setOpenWithSuggestions([...suggestions]);
        }
      } catch (error) {
        console.error("Failed to get default browser:", error);
        // If failed, at least update to show it's not loading anymore
        suggestions = suggestions.map((sugg) =>
          sugg.id === "browser" ? { ...sugg, name: "Browser (Default)" } : sugg
        );
        setOpenWithSuggestions([...suggestions]);
      }

      try {
        // Check if VS Code is available
        const vscodePath = await invoke("check_vscode_path");
        if (vscodePath) {
          suggestions.push({
            id: "vscode",
            name: "VS Code",
            icon: "📝",
            is_default: false,
          });
        } else {
          console.log("VS Code path returned null");
        }
      } catch (error) {
        console.error("VS Code not found:", error);
      }
    };

    fetchOpenWithSuggestions();
  }, []);

  // Get open_with suggestions based on command
  useEffect(() => {
    if (formData.command) {
      // Debounce to avoid too many calls
      const timer = setTimeout(() => {
        invoke<OpenWithSuggestion[]>("get_open_with_suggestions", {
          command: formData.command,
        })
          .then((suggestions) => {
            if (suggestions && suggestions.length > 0) {
              setOpenWithSuggestions(suggestions);

              // Set default option if there is one
              const defaultOption = suggestions.find((s) => s.is_default);
              if (defaultOption) {
                setFormData((prev) => ({
                  ...prev,
                  open_with: defaultOption.id,
                }));
              }
            }
          })
          .catch((err) => {
            console.error("Failed to get suggestions:", err);
          });
      }, 500); // 500ms debounce

      return () => clearTimeout(timer);
    }
  }, [formData.command]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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
    <div className="flex flex-col w-full h-full bg-gray-900 rounded-xl">
      {/* Header - Fixed at top */}
      <div className="flex items-center p-4 border-b border-gray-700">
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

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Form fields here - unchanged */}
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

          <div className="flex flex-col mb-2">
            <label htmlFor="quick-link-command" className="text-gray-400 mb-2">
              Link or Path
            </label>
            <div className="flex">
              <input
                id="quick-link-command"
                name="command"
                type="text"
                value={formData.command}
                onChange={handleChange}
                className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://www.twitter.com/search?q={query} or C:\path\to\folder"
              />
            </div>

            <div className="mt-2 text-sm text-gray-400">
              Include an argument by inserting {"{query}"} in the URL. The word
              "query" can be changed to anything and will be used as the
              placeholder text.
              <button
                onClick={insertQueryPlaceholder}
                className="ml-2 text-blue-400 hover:text-blue-300"
              >
                Insert {"{query}"}
              </button>
            </div>
          </div>

          <div className="flex flex-col mb-4">
            <label
              htmlFor="quick-link-open-with"
              className="text-gray-400 mb-2"
            >
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
                {openWithSuggestions.map((suggestion) => (
                  <option key={suggestion.id} value={suggestion.id}>
                    {suggestion.icon} {suggestion.name}
                  </option>
                ))}
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
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="flex justify-end p-4 border-t border-gray-700">
        <button
          onClick={onClose}
          className="mr-2 px-4 py-2 text-white bg-gray-800 hover:bg-gray-700 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={saveQuickLink}
          disabled={!isFormValid}
          className={`px-4 py-2 ${
            isFormValid
              ? "bg-blue-600 hover:bg-blue-500"
              : "bg-blue-600/50 cursor-not-allowed"
          } text-white rounded-md flex items-center`}
        >
          Create Quicklink
        </button>
      </div>
    </div>
  );
}
