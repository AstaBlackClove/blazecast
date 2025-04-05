import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { shell } from "@tauri-apps/api";
import { Suggestion, ActionType } from "../types";

interface AppInfo {
  name: string;
  path: string;
  icon?: string;
}

export function useSuggestions(query: string): Suggestion[] {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      const results: Suggestion[] = [];

      // If query is empty, return empty suggestions
      if (!query.trim()) {
        return setSuggestions([]);
      }

      // First, search for apps that match the query
      try {
        const appResults = await invoke<AppInfo[]>("search_apps", { query });

        // Add app results first
        appResults.forEach((app) => {
          results.push({
            id: `${ActionType.APP}_${app.name}`,
            title: app.name,
            subtitle: `Open ${app.name}`,
            category: "Applications",
            icon: app.icon,
            action: async () => {
              try {
                await invoke("open_app", { path: app.path });
              } catch (error) {
                console.error(`Failed to open ${app.name}:`, error);
              }
            },
          });
        });
      } catch (error) {
        console.error("Failed to fetch app suggestions:", error);
      }

      // Only add other actions if there are no app results or explicitly requested
      if (results.length === 0 || query.startsWith("?")) {
        // Remove the ? prefix for web searches
        const searchQuery = query.startsWith("?") ? query.slice(1) : query;

        results.push({
          id: ActionType.SEARCH_GOOGLE,
          title: `Search Google for "${searchQuery}"`,
          subtitle: `Open Google search for "${searchQuery}"`,
          category: "Web Search",
          action: () => {
            shell.open(
              `https://www.google.com/search?q=${encodeURIComponent(
                searchQuery
              )}`
            );
          },
        });

        results.push({
          id: ActionType.SEARCH_FILES,
          title: `Search Files for "${searchQuery}"`,
          subtitle: `Search for "${searchQuery}" in your files`,
          category: "System",
          action: async () => {
            try {
              await invoke("search_files", { query: searchQuery });
            } catch (error) {
              console.error("Failed to search files:", error);
            }
          },
        });
      }

      setSuggestions(results);
    };

    // Debounce function to avoid too many requests
    const timeoutId = setTimeout(() => {
      fetchSuggestions();
    }, 100); // Reduced debounce time for faster app search

    return () => clearTimeout(timeoutId);
  }, [query]);

  return suggestions;
}
