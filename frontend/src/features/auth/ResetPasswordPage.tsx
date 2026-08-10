import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  return uid && token ? <ConfirmForm uid={uid} token={token} /> : <RequestForm />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-(--surface) px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center font-display text-2xl font-semibold text-(--text-primary)">
          SheyiHub
        </div>
        {children}
      </div>
    </div>
  );
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const mutation = useMutation({ mutationFn: authApi.requestPasswordReset });

  if (mutation.isSuccess) {
    return (
      <Shell>
        <div className="rounded-xl border border-(--border) bg-(--surface-raised) p-6 text-center text-sm text-(--text-secondary) shadow-[var(--shadow-elevation-1)]">
          If that account exists, we've sent a reset link to <strong>{email}</strong>.
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          mutation.mutate({ email });
        }}
        className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--surface-raised) p-6 shadow-[var(--shadow-elevation-1)]"
      >
        <p className="text-sm text-(--text-secondary)">
          Enter your email and we'll send you a link to reset your password.
        </p>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" isLoading={mutation.isPending} disabled={!email}>
          Send reset link
        </Button>
        <Link
          to="/login"
          className="text-center text-sm text-(--text-secondary) hover:text-pine dark:hover:text-ember"
        >
          Back to login
        </Link>
      </form>
    </Shell>
  );
}

function ConfirmForm({ uid, token }: { uid: string; token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: authApi.confirmPasswordReset,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong."),
  });

  if (mutation.isSuccess) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-(--border) bg-(--surface-raised) p-6 text-center shadow-[var(--shadow-elevation-1)]">
          <p className="text-sm text-(--text-secondary)">Your password has been reset.</p>
          <Link to="/login" className="text-sm font-medium text-pine dark:text-ember hover:underline">
            Continue to login
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          setError(null);
          mutation.mutate({ uid, token, new_password: newPassword });
        }}
        className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--surface-raised) p-6 shadow-[var(--shadow-elevation-1)]"
      >
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="At least 8 characters."
          error={error ?? undefined}
        />
        <Button type="submit" isLoading={mutation.isPending} disabled={!newPassword}>
          Reset password
        </Button>
      </form>
    </Shell>
  );
}
