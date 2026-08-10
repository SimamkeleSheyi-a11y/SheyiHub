import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTypingStore } from "@/stores/typingStore";

describe("typingStore", () => {
  it("adds a user to the typing set for a conversation", () => {
    useTypingStore.getState().setTyping("conv-1", "user-1", true);
    expect(useTypingStore.getState().typingByConversation["conv-1"].has("user-1")).toBe(true);
  });

  it("removes a user when they stop typing", () => {
    useTypingStore.getState().setTyping("conv-2", "user-1", true);
    useTypingStore.getState().setTyping("conv-2", "user-1", false);
    expect(useTypingStore.getState().typingByConversation["conv-2"].has("user-1")).toBe(false);
  });

  it("keeps conversations independent", () => {
    useTypingStore.getState().setTyping("conv-a", "user-1", true);
    useTypingStore.getState().setTyping("conv-b", "user-2", true);
    expect(useTypingStore.getState().typingByConversation["conv-a"].has("user-2")).toBe(false);
  });
});

describe("typingStore TTL (Phase 5 hardening — clears if a tab closes or the connection drops)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("auto-clears a typing user if no refresh arrives within the expiry window", () => {
    useTypingStore.getState().setTyping("conv-ttl", "user-1", true);
    expect(useTypingStore.getState().typingByConversation["conv-ttl"].has("user-1")).toBe(true);

    vi.advanceTimersByTime(5000);

    expect(useTypingStore.getState().typingByConversation["conv-ttl"].has("user-1")).toBe(false);
  });

  it("does not expire while refreshed before the window elapses", () => {
    useTypingStore.getState().setTyping("conv-ttl2", "user-1", true);
    vi.advanceTimersByTime(3000);
    useTypingStore.getState().setTyping("conv-ttl2", "user-1", true); // refresh, e.g. another keystroke

    vi.advanceTimersByTime(3000); // 6s total, but only 3s since the refresh
    expect(useTypingStore.getState().typingByConversation["conv-ttl2"].has("user-1")).toBe(true);

    vi.advanceTimersByTime(2000); // now 5s since the refresh
    expect(useTypingStore.getState().typingByConversation["conv-ttl2"].has("user-1")).toBe(false);
  });
});
