import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { AppInfo } from "../../types";

interface ManualAppEntryProps {
  onClose: () => void;
  onSave: () => void;
}

export const ManualAppEntry = ({ onClose, onSave }: ManualAppEntryProps) => {
  const [appName, setAppName] = useState("");
  const [appPath, setAppPath] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isFormValid, setIsFormValid] = useState(false);

  // Validate form whenever inputs change
  useEffect(() => {
    setIsFormValid(!!appName.trim() && !!appPath.trim());
  }, [appName, appPath]);

  const validatePath = (path: string): boolean => {
    // Trim potential quotes and whitespace
    const trimmedPath = path.trim().replace(/^"(.*)"$/, "$1");

    // Check if path ends with .exe or .lnk which are both acceptable
    return (
      trimmedPath.toLowerCase().endsWith(".exe") ||
      trimmedPath.toLowerCase().endsWith(".lnk")
    );
  };

  const handleSave = async () => {
    // Reset any previous errors
    setError("");

    if (!appName.trim()) {
      setError("Application name is required");
      return;
    }

    if (!appPath.trim()) {
      setError("Application path is required");
      return;
    }

    // Validate path format
    if (!validatePath(appPath)) {
      setError("Path must point to an .exe or .lnk file");
      return;
    }

    try {
      setSaving(true);

      // First add the manual application
      await invoke<AppInfo>("add_manual_application", {
        name: appName.trim(),
        path: appPath.trim(),
      });

      // Then explicitly refresh the app index to ensure it's updated
      await invoke("refresh_app_index");

      setSaving(false);
      onSave(); // This will close the dialog and update the UI
    } catch (err) {
      setSaving(false);
      setError(err as string);
      console.error("Error adding application:", err);
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-gray-900 text-white">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Add Application Manually</h2>
        <p className="text-gray-400 mt-2">
          Add applications that couldn't be detected automatically
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 p-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4 flex-grow overflow-auto px-2">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Application Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Zen"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Executable Path <span className="text-red-500">*</span>
          </label>
          <div className="flex">
            <input
              type="text"
              value={appPath}
              onChange={(e) => setAppPath(e.target.value)}
              className="flex-grow bg-gray-800 border border-gray-700 rounded-l py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="C:\Program Files\Zen Browser\zen.exe or path to .lnk file"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Provide path to an .exe file or .lnk shortcut file
          </p>
        </div>
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !isFormValid}
            className={`px-4 py-2 rounded transition flex items-center ${
              saving || !isFormValid
                ? "bg-blue-600/50 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </>
            ) : (
              "Add Application"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
