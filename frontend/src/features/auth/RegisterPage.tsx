import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";

export function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        setFieldErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v[0]])));
      }
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    registerMutation.mutate({ email, password, display_name: displayName });
  }

  if (registerMutation.isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--surface) px-4">
        <div className="flex max-w-[400px] flex-col items-center gap-3 rounded-xl border border-(--border) bg-(--surface-raised) p-8 text-center shadow-[var(--shadow-elevation-1)]">
          <MailCheck className="size-8 text-signal" aria-hidden />
          <h1 className="font-display text-lg font-semibold text-(--text-primary)">Check your email</h1>
          <p className="text-sm text-(--text-secondary)">
            We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="text-sm font-medium text-pine dark:text-ember hover:underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--surface) px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 text-center font-display text-2xl font-semibold text-(--text-primary)">
          SheyiHub
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--surface-raised) p-6 shadow-[var(--shadow-elevation-1)]"
        >
          <Input
            label="Display name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            hint="At least 8 characters."
          />
          <Button
            type="submit"
            isLoading={registerMutation.isPending}
            disabled={!email || !password || !displayName}
          >
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-(--text-secondary)">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-pine dark:text-ember hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
