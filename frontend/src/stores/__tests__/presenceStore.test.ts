import { describe, expect, it } from "vitest";

import { usePresenceStore } from "@/stores/presenceStore";

describe("presenceStore", () => {
  it("stores and retrieves a user's status", () => {
    usePresenceStore.getState().setStatus("user-1", "online");
    expect(usePresenceStore.getState().statuses["user-1"]).toEqual({ status: "online", last_seen: null });
  });

  it("overwrites status on update", () => {
    usePresenceStore.getState().setStatus("user-2", "online");
    usePresenceStore.getState().setStatus("user-2", "offline", "2026-01-01T00:00:00Z");
    expect(usePresenceStore.getState().statuses["user-2"]).toEqual({
      status: "offline",
      last_seen: "2026-01-01T00:00:00Z",
    });
  });
});
