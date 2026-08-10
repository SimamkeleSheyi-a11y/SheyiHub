import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/authStore";
import type { ThemePreference } from "@/types/user";

const STORAGE_KEY = "sheyihub-theme";

interface ThemeContextValue {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredTheme(): ThemePreference {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : "system";
  } catch {
    // Storage can be unavailable in tests, privacy modes, or restricted embeds.
    return "system";
  }
}

function storeTheme(theme: ThemePreference) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, theme);
  } catch {
    // Theme still works for the current session even when persistence is unavailable.
  }
}

function applyThemeClass(theme: ThemePreference) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const prefersDark =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(readStoredTheme);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    applyThemeClass(theme);
    storeTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (theme === "system") applyThemeClass("system");
    };

    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, [theme]);

  useEffect(() => {
    if (user?.theme_preference) setThemeState(user.theme_preference);
  }, [user?.theme_preference]);

  const setTheme = (next: ThemePreference) => {
    const previous = theme;
    setThemeState(next);

    if (useAuthStore.getState().user) {
      authApi
        .updateMe({ theme_preference: next })
        .then((updated) => useAuthStore.getState().updateUser(updated))
        .catch(() => {
          // Keep the local choice usable even if the network is temporarily unavailable.
          // The next successful account update can persist it again.
          if (!useAuthStore.getState().user) setThemeState(previous);
        });
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
