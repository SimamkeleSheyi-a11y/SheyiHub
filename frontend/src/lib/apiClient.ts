import { useAuthStore } from "@/stores/authStore";

import { readCookie } from "./cookies";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, code?: string, errors?: Record<string, string[]>) {
    super(ApiError.pickBestMessage(message, errors));
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  /**
   * DRF validation errors come back as {"detail": "Validation failed.",
   * "errors": {"field": ["specific reason"]}} — the generic summary alone
   * ("Something went wrong.") isn't what the person needs to see; the
   * specific reason is. Prefer it when there's exactly one to show.
   */
  private static pickBestMessage(fallback: string, errors?: Record<string, string[]>): string {
    if (!errors) return fallback;
    const messages = Object.values(errors).flat();
    return messages.length === 1 ? messages[0] : fallback;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const csrfToken = readCookie("sheyihub_csrf");
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.access as string;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function parseErrorBody(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Every real request goes through here. `retry` is internal — callers
 * never pass it; it's how we make sure a refresh-and-retry only happens once.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };

  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: "include",
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch() itself threw — never reached the server (offline, DNS, connection refused).
    throw new ApiError(0, "Network connection lost. Check your connection and try again.", "network");
  }

  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      useAuthStore.getState().setAuth(useAuthStore.getState().user!, newAccess);
      return apiFetch<T>(path, options, false);
    }
    useAuthStore.getState().clearAuth();
  }

  if (!res.ok) {
    const body = await parseErrorBody(res);
    throw new ApiError(res.status, body.detail ?? "Something went wrong.", body.code, body.errors);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
