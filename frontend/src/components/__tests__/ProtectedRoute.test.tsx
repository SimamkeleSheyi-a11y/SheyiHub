import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuthStore } from "@/stores/authStore";

function renderProtected(initialEntry = "/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>Secret dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, isInitializing: false });
  });

  it("redirects to /login when there is no authenticated user", () => {
    useAuthStore.setState({ user: null, accessToken: null, isInitializing: false });
    renderProtected();
    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });

  it("renders the protected content once a user is present", () => {
    useAuthStore.setState({
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
      accessToken: "token",
      isInitializing: false,
    });
    renderProtected();
    expect(screen.getByText("Secret dashboard")).toBeInTheDocument();
  });

  it("shows a loading state instead of redirecting while session restoration is in flight", () => {
    useAuthStore.setState({ user: null, accessToken: null, isInitializing: true });
    renderProtected();
    expect(screen.queryByText("Login screen")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
  });
});
