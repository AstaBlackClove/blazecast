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

      const queryLower = trimmedQuery.toLowerCase();

      // Define action patterns with their corresponding suggestion creator functions
      const actionPatterns = [
        {
          // Matches: quick link, link, create, new, etc.
          match: (q: string) =>
            /^(q|qui|cre|create|new|link|quicklink|quick link)/i.test(q),
          createSuggestion: () => ({
            id: ActionType.CREATE_QUICK_LINK,
            title: "Create Quick Link",
            subtitle: "Create a new quick link to a website or application",
            category: "Actions",
            icon: "🔗",
          }),
        },
        {
          // Matches: refresh, reload, re, ref, etc.
          match: (q: string) => /^(re|ref|refr|refresh|reload)/i.test(q),
          createSuggestion: () => ({
            id: ActionType.REFRESH_APP_INDEX,
            title: "Refresh App",
            subtitle: "Refresh indexed application to detect new applications",
            category: "Actions",
            icon: "🔄",
            action: async () => {
              try {
                await invoke("refresh_app_index");
              } catch (error) {
                console.error("Failed to refresh app index:", error);
              }
            },
          }),
        },
        {
          // Matches: add, manual entry, app entry, etc.
          match: (q: string) => /^(add|manual|manualentry|appentry)/i.test(q),
          createSuggestion: () => ({
            id: "add_manual_app",
            title: "Add Application Manually",
            subtitle:
              "Add custom applications that weren't detected automatically",
            icon: "➕",
            category: "System",
          }),
        },
      ];

      // Check for action patterns and add corresponding suggestions
      // Use priority order (only add first matching action)
      for (const pattern of actionPatterns) {
        if (pattern.match(queryLower)) {
          results.push(pattern.createSuggestion());
          break; // Only add the first matching action
        }
      }

      // Fetch app results
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

      // Fetch saved quick links
      try {
        const quickLinks: any[] = await invoke("search_quick_links", {
          query: trimmedQuery,
        });

        quickLinks.forEach((link) => {
          results.push({
            id: link.id,
            title: link.name,
            subtitle: link.description || link.command,
            category: "Quick Links",
            icon: link.icon || "🔗",
            action: async () => {
              try {
                await invoke("execute_quick_link", { quickLinkId: link.id });
              } catch (error) {
                console.error(
                  `Failed to execute quick link ${link.name}:`,
                  error
                );
              }
            },
          });
        });
      } catch (error) {
        console.error("Failed to fetch quick links:", error);
      }

      // Always add search actions at the bottom
      const searchActions: Suggestion[] = [
        {
          id: `${ActionType.SEARCH_DUCKDUCKGO}_${searchQuery}`,
          title: `Search DuckDuckGo for "${searchQuery}"`,
          subtitle: `duckduckgo.com`,
          category: "Web Search",
          icon: "https://duckduckgo.com/favicon.ico",
          action: () => {
            shell.open(
              `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`
            );
          },
        },
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
