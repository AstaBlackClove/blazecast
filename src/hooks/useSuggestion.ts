import { invoke } from "@tauri-apps/api/tauri";
import { useState, useEffect } from "react";
import { Suggestion } from "../types";

const mockSuggestions: Suggestion[] = [
  {
    id: "1",
    title: "Open Google",
    subtitle: "https://google.com",
    action: () => window.open("https://google.com", "_blank"),
  },
  {
    id: "2",
    title: "Open Calculator",
    subtitle: "System app",
    action: () => invoke("open_calculator"),
  },
  {
    id: "3",
    title: "Take Screenshot",
    subtitle: "Screen capture utility",
    action: () => console.log("Screenshot taken"),
  },
  {
    id: "4",
    title: "Take Screenshot",
    subtitle: "Screen capture utility",
    action: () => console.log("Screenshot taken"),
  },
  {
    id: "5",
    title: "Take Screenshot",
    subtitle: "Screen capture utility",
    action: () => console.log("Screenshot taken"),
  },
];

export function useSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (query.trim() === "") {
      setSuggestions([]);
    } else {
      const filtered = mockSuggestions.filter((s) =>
        s.title.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
    }
  }, [query]);

  return suggestions;
}
