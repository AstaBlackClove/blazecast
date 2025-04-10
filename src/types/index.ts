import { invoke } from "@tauri-apps/api/tauri";

export interface Suggestion {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  path?: string;
  category: string;
  action?: () => void | Promise<void>;
}

export interface AppInfo {
  id: string;
  name: string;
  path: string;
  icon: string;
  category: string;
  last_accessed?: number;
  access_count: number;
}

export enum ActionType {
  APP = "app",
  SEARCH_GOOGLE = "search_google",
  SEARCH_DUCKDUCKGO = "search_duckduckgo",
  SEARCH_FILES = "search_files",
  CREATE_QUICK_LINK = "create_quick_link",
  EXECUTE_QUICK_LINK = "execute_quick_link",
}

// New interface for Quick Links
export interface QuickLink {
  id: string;
  name: string;
  command: string;
  icon: string;
  openWith: "terminal" | "browser" | "app";
  description?: string;
  lastUsed?: number;
  useCount?: number;
}

// Convert AppInfo from backend to Suggestion for frontend
export function appToSuggestion(app: AppInfo): Suggestion {
  return {
    id: app.id,
    title: app.name,
    subtitle: app.path,
    icon: app.icon,
    path: app.path,
    category: app.category,
  };
}

// Convert QuickLink to Suggestion
export function quickLinkToSuggestion(quickLink: QuickLink): Suggestion {
  return {
    id: `${ActionType.EXECUTE_QUICK_LINK}_${quickLink.id}`,
    title: quickLink.name,
    subtitle: quickLink.description || quickLink.command,
    icon: quickLink.icon,
    category: "Quick Links",
    action: async () => {
      try {
        // If the command contains {query}, we'll handle it separately
        if (quickLink.command.includes("{query}")) {
          // This could open a secondary prompt for the query part
          await invoke("execute_quick_link_with_query", {
            quickLinkId: quickLink.id,
          });
        } else {
          await invoke("execute_quick_link", { quickLinkId: quickLink.id });
        }
      } catch (error) {
        console.error(`Failed to execute quick link ${quickLink.name}:`, error);
      }
    },
  };
}
