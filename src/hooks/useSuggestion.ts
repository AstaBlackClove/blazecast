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

      // Check for quick link creation keywords
      const quickLinkKeywords = [
        'q',
        'qui',
        "cre",
        "create",
        "new",
        "link",
        "quicklink",
        "quick link",
      ];

      const refreshKeyword = ["re", "refresh", "reload"];
      const addManualAppSuggestion = ["add", "manualentry", "appentry"];

      const shouldShowQuickLink = quickLinkKeywords.some((keyword) =>
        trimmedQuery.toLowerCase().includes(keyword)
      );

      const shouldShowRefresh = refreshKeyword.some((keyword) =>
        trimmedQuery.toLowerCase().includes(keyword)
      );

      const shouldShowManualApp = addManualAppSuggestion.some((keyword) =>
        trimmedQuery.toLowerCase().includes(keyword)
      );

      if (shouldShowQuickLink) {
        results.push({
          id: ActionType.CREATE_QUICK_LINK,
          title: "Create Quick Link",
          subtitle: "Create a new quick link to a website or application",
          category: "Actions",
          icon: "🔗",
        });
      }

      if (shouldShowRefresh) {
        results.push({
          id: ActionType.REFRESH_APP_INDEX,
          title: "Refresh App",
          subtitle: "Refresh indexed applicaiton to detect new application",
          category: "Actions",
          icon: "🔄",
          action: async () => {
            try {
              await invoke("refresh_app_index");
            } catch (error) {
              console.error("Failed to refresh app index:", error);
            }
          },
        });
      }

      if (shouldShowManualApp) {
        results.push({
          id: "add_manual_app",
          title: "Add Application Manually",
          subtitle:
            "Add custom applications that weren't detected automatically",
          icon: "➕",
          category: "System",
        });
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
                console.log("From useSugggestion.tsx")
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
        const quickLinks: any[] = await invoke("get_quick_links");
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
