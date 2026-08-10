import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { authApi } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.access);
      navigate(from, { replace: true });
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    loginMutation.mutate({ email, password });
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
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {formError ? (
            <p role="alert" className="text-sm text-rust">
              {formError}
            </p>
          ) : null}
          <Button type="submit" isLoading={loginMutation.isPending} disabled={!email || !password}>
            Log in
          </Button>
          <Link
            to="/reset-password"
            className="text-center text-sm text-(--text-secondary) hover:text-pine dark:hover:text-ember"
          >
            Forgot password?
          </Link>
        </form>
        <p className="mt-4 text-center text-sm text-(--text-secondary)">
          New to SheyiHub?{" "}
          <Link to="/register" className="font-medium text-pine dark:text-ember hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
