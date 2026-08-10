import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "@/features/auth/LoginPage";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";

vi.mock("@/features/auth/api", () => ({
  authApi: { login: vi.fn() },
}));
import { authApi } from "@/features/auth/api";

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(authApi.login).mockReset();
  });
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, isInitializing: false });
  });

  it("logs in and navigates to the dashboard on success", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      access: "token123",
      user: {
        id: "1",
        email: "a@example.com",
        display_name: "A",
        avatar_url: "",
        bio: "",
        email_verified: true,
        theme_preference: "system",
        created_at: "2026-01-01T00:00:00Z",
      },
    });

    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correcthorse");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => expect(screen.getByText("Dashboard")).toBeInTheDocument());
    expect(useAuthStore.getState().accessToken).toBe("token123");
  });

  it("shows an inline error on invalid credentials without navigating away", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError(401, "Incorrect email or password."));

    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });
});
