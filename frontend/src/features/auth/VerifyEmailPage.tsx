import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MailWarning, XCircle } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import { Button } from "@/components/Button";
import { authApi } from "@/features/auth/api";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const location = useLocation();
  const isPendingVisit = (location.state as { pending?: boolean })?.pending;
  const user = useAuthStore((s) => s.user);

  const verifyMutation = useMutation({ mutationFn: authApi.verifyEmail });
  const resendMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => toast.success("Verification email sent."),
  });

  useEffect(() => {
    if (uid && token) verifyMutation.mutate({ uid, token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token]);

  // Landed here from a real verification link
  if (uid && token) {
    return (
      <StatusScreen
        state={
          verifyMutation.isPending
            ? "loading"
            : verifyMutation.isSuccess
              ? "success"
              : verifyMutation.isError
                ? "error"
                : "loading"
        }
      />
    );
  }

  // Landed here because a signed-in-but-unverified user tried to do something gated
  if (isPendingVisit || (user && !user.email_verified)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--surface) px-4">
        <div className="flex max-w-[400px] flex-col items-center gap-3 rounded-xl border border-(--border) bg-(--surface-raised) p-8 text-center shadow-[var(--shadow-elevation-1)]">
          <MailWarning className="size-8 text-ember" aria-hidden />
          <h1 className="font-display text-lg font-semibold text-(--text-primary)">Verify your email</h1>
          <p className="text-sm text-(--text-secondary)">
            Check <strong>{user?.email}</strong> for a verification link before scheduling or joining
            meetings.
          </p>
          <Button
            onClick={() => resendMutation.mutate()}
            isLoading={resendMutation.isPending}
            variant="secondary"
          >
            Resend email
          </Button>
        </div>
      </div>
    );
  }

  return <StatusScreen state="error" />;
}

function StatusScreen({ state }: { state: "loading" | "success" | "error" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--surface) px-4">
      <div className="flex max-w-[400px] flex-col items-center gap-3 rounded-xl border border-(--border) bg-(--surface-raised) p-8 text-center shadow-[var(--shadow-elevation-1)]">
        {state === "loading" ? (
          <p className="text-sm text-(--text-secondary)">Verifying your email…</p>
        ) : state === "success" ? (
          <>
            <CheckCircle2 className="size-8 text-signal" aria-hidden />
            <h1 className="font-display text-lg font-semibold text-(--text-primary)">Email verified</h1>
            <Link to="/login" className="text-sm font-medium text-pine dark:text-ember hover:underline">
              Continue to login
            </Link>
          </>
        ) : (
          <>
            <XCircle className="size-8 text-rust" aria-hidden />
            <h1 className="font-display text-lg font-semibold text-(--text-primary)">
              This link is invalid or expired
            </h1>
            <Link to="/login" className="text-sm font-medium text-pine dark:text-ember hover:underline">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
