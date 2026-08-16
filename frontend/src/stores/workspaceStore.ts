import { create } from "zustand";

interface WorkspaceState {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
}

const STORAGE_KEY = "sheyihub-active-workspace";

function initialWorkspaceId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeWorkspaceId: initialWorkspaceId(),
  setActiveWorkspaceId: (id) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ activeWorkspaceId: id });
  },
}));
