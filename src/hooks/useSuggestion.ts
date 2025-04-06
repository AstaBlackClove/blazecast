import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { shell } from "@tauri-apps/api";
import { Suggestion, AppInfo, ActionType } from "../types";

export function useSuggestions(query: string): Suggestion[] {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const results: Suggestion[] = [];
      const trimmedQuery = query.trim();
      const searchQuery = query.startsWith("?") ? query.slice(1) : query;

      if (!trimmedQuery) {
        setSuggestions([]);
        return;
      }

      // Fetch app results first
      try {
        const appResults: AppInfo[] = await invoke("search_apps", {
          query: trimmedQuery,
        });
        appResults.forEach((app) => {
          results.push({
            id: app.id,
            title: app.name,
            subtitle: `Open ${app.name}`,
            category: "Applications",
            icon: app.icon,
            action: async () => {
              try {
                await invoke("open_app", { appId: app.id });
              } catch (error) {
                console.error(`Failed to open ${app.name}:`, error);
              }
            },
          });
        });
      } catch (error) {
        console.error("Failed to fetch app suggestions:", error);
      }

      // Always add search actions at the bottom
      const searchActions: Suggestion[] = [
        {
          id: `${ActionType.SEARCH_GOOGLE}_${searchQuery}`,
          title: `Search Google for "${searchQuery}"`,
          subtitle: `www.google.com`,
          category: "Web Search",
          icon: "https://www.google.com/favicon.ico",
          action: () => {
            shell.open(
              `https://www.google.com/search?q=${encodeURIComponent(
                searchQuery
              )}`
            );
          },
        },
        {
          id: `${ActionType.SEARCH_FILES}_${searchQuery}`,
          title: `Find files matching "${searchQuery}"`,
          subtitle: `Search local files`,
          category: "File Search",
          icon: "📁",
          action: async () => {
            try {
              await invoke("search_files", { query: searchQuery });
            } catch (error) {
              console.error("Failed to search files:", error);
            }
          },
        },
      ];

      setSuggestions([...results, ...searchActions]);
    };

    const timeoutId = setTimeout(fetchSuggestions, 100);
    return () => clearTimeout(timeoutId);
  }, [query]);

  return suggestions;
}
