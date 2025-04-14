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
  REFRESH_APP_INDEX = "refresh_app_index",
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

