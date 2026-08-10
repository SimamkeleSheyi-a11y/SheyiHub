import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/wsClient", () => ({
  wsClient: { send: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), on: vi.fn(() => () => {}) },
}));
vi.mock("@/features/auth/api", () => ({
  authApi: { logout: vi.fn().mockResolvedValue(undefined), updateMe: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/features/notifications/NotificationBell", () => ({
  NotificationBell: () => null,
}));

import { TopBar } from "@/components/TopBar";
import { ThemeProvider } from "@/hooks/useTheme";
import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import { usePresenceStore } from "@/stores/presenceStore";

const me = {
  id: "me-1",
  email: "me@example.com",
  display_name: "Me",
  avatar_url: "",
  bio: "",
  email_verified: true,
  theme_preference: "system" as const,
  created_at: "2026-01-01T00:00:00Z",
};

function renderTopBar() {
  useAuthStore.setState({ user: me, accessToken: "token", isInitializing: false });
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <TopBar />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("TopBar status selector", () => {
  beforeEach(() => {
    vi.mocked(wsClient.send).mockReset();
    usePresenceStore.setState({ statuses: {} });
  });

  it("sends a set-status event to the backend when a status is picked, not just local state", async () => {
    renderTopBar();
    await userEvent.click(screen.getByRole("button", { name: /Online/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Away/i }));

    expect(wsClient.send).toHaveBeenCalledWith({ type: "set-status", status: "away" });
  });

  it("reflects the confirmed status from the backend (presence store), not an assumed local value", async () => {
    renderTopBar();
    expect(screen.getByRole("button", { name: /Online/i })).toBeInTheDocument();

    usePresenceStore.getState().setStatus(me.id, "away" as never);
    expect(await screen.findByRole("button", { name: /Away/i })).toBeInTheDocument();
  });
});
