import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
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

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Executables", extensions: ["exe"] }],
      });
      
      if (selected && !Array.isArray(selected)) {
        setAppPath(selected);
        // If no name is set yet, use the filename without extension
        if (!appName) {
          const pathParts = selected.split(/[\\\/]/);
          const fileName = pathParts[pathParts.length - 1];
          // Remove .exe extension if present
          setAppName(fileName.replace(/\.exe$/i, ""));
        }
      }
    } catch (err) {
      console.error("Failed to select file:", err);
    }
  };

  const handleSave = async () => {
    if (!appName.trim()) {
      setError("Application name is required");
      return;
    }
    
    if (!appPath.trim()) {
      setError("Application path is required");
      return;
    }
    
    try {
      setSaving(true);
      await invoke<AppInfo>("add_manual_application", { 
        name: appName.trim(), 
        path: appPath.trim() 
      });
      
      setSaving(false);
      onSave();
    } catch (err) {
      setSaving(false);
      setError(err as string);
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

      <div className="space-y-4 flex-grow">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Application Name
          </label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Discord"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Executable Path
          </label>
          <div className="flex">
            <input
              type="text"
              value={appPath}
              onChange={(e) => setAppPath(e.target.value)}
              className="flex-grow bg-gray-800 border border-gray-700 rounded-l py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="C:\Program Files\Discord\Update.exe --processStart Discord.exe"
            />
            <button
              onClick={handleSelectFile}
              className="bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-r px-4 transition"
            >
              Browse
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            For some applications like Discord, you may need to specify launch parameters
          </p>
        </div>

        <div className="text-sm text-gray-400 mt-4">
          <h3 className="font-medium mb-1">Tips:</h3>
          <ul className="list-disc list-inside space-y-1 text-gray-500">
            <li>For Discord, use: "Update.exe --processStart Discord.exe"</li>
            <li>You can add command line arguments if needed</li>
            <li>Icons will be extracted automatically from the executable</li>
          </ul>
        </div>
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
          disabled={saving}
          className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition flex items-center ${
            saving ? "opacity-75" : ""
          }`}
        >
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            "Add Application"
          )}
        </button>
      </div>
    </div>
  );
};