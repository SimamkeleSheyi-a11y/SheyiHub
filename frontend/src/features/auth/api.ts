import { apiFetch } from "@/lib/apiClient";
import type { User } from "@/types/user";

interface LoginResponse {
  access: string;
  user: User;
}

interface ResendVerificationResponse {
  detail: string;
  cooldown_seconds: number;
}

export const authApi = {
  register: (data: { email: string; password: string; display_name: string }) =>
    apiFetch<User>("/auth/register", { method: "POST", body: data }),

  login: (data: { email: string; password: string }) =>
    apiFetch<LoginResponse>("/auth/login", { method: "POST", body: data }),

  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),

  refresh: () =>
    apiFetch<{ access: string }>("/auth/refresh", { method: "POST" }),

  // Legacy verification-link support for links sent before the 6-digit rollout.
  verifyEmail: (data: { uid: string; token: string }) =>
    apiFetch<{ detail: string }>("/auth/verify-email", {
      method: "POST",
      body: data,
    }),

  verifyEmailCode: (data: { email: string; code: string }) =>
    apiFetch<{ detail: string; email_verified: true; email: string }>(
      "/auth/verify-email/code",
      { method: "POST", body: data },
    ),

  resendVerification: (data: { email?: string } = {}) =>
    apiFetch<ResendVerificationResponse>("/auth/resend-verification", {
      method: "POST",
      body: data,
    }),

  requestPasswordReset: (data: { email: string }) =>
    apiFetch<{ detail: string }>("/auth/password-reset/request", {
      method: "POST",
      body: data,
    }),

  confirmPasswordReset: (data: {
    uid: string;
    token: string;
    new_password: string;
  }) =>
    apiFetch<{ detail: string }>("/auth/password-reset/confirm", {
      method: "POST",
      body: data,
    }),

  me: () => apiFetch<User>("/users/me"),

  wsTicket: () =>
    apiFetch<{ ticket: string }>("/auth/ws-ticket", { method: "POST" }),

  updateMe: (
    data: Partial<
      Pick<User, "display_name" | "avatar_url" | "bio" | "theme_preference">
    >,
  ) => apiFetch<User>("/users/me", { method: "PATCH", body: data }),
};
