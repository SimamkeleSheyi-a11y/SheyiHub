import { create } from "zustand";

import type { User } from "@/types/user";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isInitializing: boolean; // true while we're attempting session restoration on boot
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  updateUser: (patch: Partial<User>) => void;
  clearAuth: () => void;
  setInitializing: (value: boolean) => void;
}

/**
 * Deliberately NOT persisted to localStorage/sessionStorage — the access
 * token lives only in memory for the life of the tab (Phase 2 §9). Session
 * restoration on reload works by calling /auth/refresh on boot instead
 * (see hooks/useSessionRestore.ts), using the httpOnly refresh cookie.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isInitializing: true,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  updateUser: (patch) => set((state) => ({ user: state.user ? { ...state.user, ...patch } : state.user })),
  clearAuth: () => set({ user: null, accessToken: null }),
  setInitializing: (value) => set({ isInitializing: value }),
}));
