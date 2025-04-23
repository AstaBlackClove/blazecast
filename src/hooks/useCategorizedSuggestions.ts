import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { AppInfo, appToSuggestion, Suggestion } from "../types";
import { useSuggestions } from "./useSuggestion";

export const useCategorizedSuggestions = {
  processRecentApps: (apps: AppInfo[]) => {
    // Generate suggestions with updated action handlers
    const recentSuggestions = apps.map((app) => ({
      ...appToSuggestion(app),
      action: async () => {
        // Ensure we're opening the correct app by ID
        await invoke("open_app", { appId: app.id });
        return false; // No modal opened
      },
    }));

    // Group recent apps by category
    const categorized = recentSuggestions.reduce<Record<string, Suggestion[]>>(
      (acc, suggestion: any) => {
        const category = suggestion.category || "Other";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push(suggestion);
        return acc;
      },
      {}
    );

    // Return both flat and categorized data
    return {
      flat: recentSuggestions,
      categorized: categorized,
    };
  },

  processSuggestions: (query: string, setQuickLinkQueryData: Function) => {
    // Get raw suggestions
    const rawSuggestions: Suggestion[] = useSuggestions(query);

    // Process suggestions with enhanced action handlers
    return useMemo(() => {
      const processed = rawSuggestions.map((suggestion) => {
        // If this is a quick link from search results, ensure it has the right action handler
        if (suggestion.category === "Quick Links") {
          return {
            ...suggestion,
            action: async () => {
              // Extract the command from the subtitle if available
              const command = suggestion.subtitle || "";

              if (command.includes("{query}")) {
                setQuickLinkQueryData({
                  id: suggestion.id,
                  name: suggestion.title,
                  command: command,
                });
                return true; // Return true to indicate we're showing a modal
              } else {
                // Execute directly using the ID
                await invoke("execute_quick_link", {
                  quickLinkId: suggestion.id,
                });
                return false; // No modal opened
              }
            },
          };
        }
        return suggestion;
      });

      // Group suggestions by category
      const categorized = processed.reduce<Record<string, Suggestion[]>>(
        (acc, suggestion: any) => {
          const category = suggestion.category || "Other";
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(suggestion);
          return acc;
        },
        {}
      );

      return {
        flat: processed,
        categorized: categorized,
      };
    }, [rawSuggestions, setQuickLinkQueryData]);
  },
};