import { useEffect } from "react";

import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/authStore";

export function useSessionRestore() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setInitializing = useAuthStore((s) => s.setInitializing);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const { access } = await authApi.refresh();
        if (cancelled) return;
        // Need a token in the store before /users/me can succeed, since
        // apiFetch reads it from the store for the Authorization header.
        useAuthStore.getState().setAccessToken(access);
        const user = await authApi.me();
        if (!cancelled) setAuth(user, access);
      } catch {
        if (!cancelled) useAuthStore.getState().clearAuth();
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
