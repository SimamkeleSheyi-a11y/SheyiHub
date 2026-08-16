import { apiFetch } from "@/lib/apiClient";

export type SearchKind = "workspace" | "task" | "meeting" | "message" | "person";

export interface GlobalSearchResult {
  id: string;
  kind: SearchKind;
  label: string;
  subtitle: string;
  target_url: string;
}

export const searchApi = {
  search: (query: string) => apiFetch<{ results: GlobalSearchResult[] }>(`/search/?q=${encodeURIComponent(query)}`),
};
