export interface Suggestion {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  iconColor?: string;
  path?: string;
  category: string;
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

// Convert AppInfo from backend to Suggestion for frontend
export function appToSuggestion(app: AppInfo): Suggestion {
  return {
    id: app.id,
    title: app.name,
    subtitle: app.path,
    icon: app.icon,
    path: app.path,
    category: app.category
  };
}