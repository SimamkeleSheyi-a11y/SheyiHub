import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuthStore } from "@/stores/authStore";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isInitializing } = useAuthStore();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--text-secondary)" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

/** Gates actions/screens that need email_verified = true (Phase 2 §5). */
export function RequireVerified({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user && !user.email_verified) {
    return <Navigate to="/verify-email" state={{ pending: true }} replace />;
  }
  return <>{children}</>;
}
