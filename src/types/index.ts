export interface Suggestion {
  id: string;
  title: string;
  subtitle?: string;
  action: () => void;
  category?: string;
  icon?: string;
  iconColor?: string;
}

export interface AppInfo {
  name: string;
  path: string;
  icon: string;
}

export enum ActionType {
  APP = 'app',
  SEARCH_FILES = 'search_files',
  SEARCH_WEB = 'search_web',
  SEARCH_GOOGLE = 'search_google',
  SEARCH_ZEN = 'search_zen',
}