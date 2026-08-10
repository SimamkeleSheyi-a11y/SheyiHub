import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/chats/api", () => ({
  chatsApi: {
    listConversations: vi.fn(),
    listMessages: vi.fn(),
    startConversation: vi.fn(),
    sendMessage: vi.fn(),
  },
}));
vi.mock("@/lib/wsClient", () => ({
  wsClient: {
    send: vi.fn(() => true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(() => () => {}),
    isConnected: vi.fn(() => true),
  },
}));

import { ChatsPage } from "@/features/chats/ChatsPage";
import { chatsApi } from "@/features/chats/api";
import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import { useReadReceiptStore } from "@/stores/readReceiptStore";
import { useTypingStore } from "@/stores/typingStore";
import type { Message } from "@/types/messaging";

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
const other = {
  id: "other-1",
  email: "other@example.com",
  display_name: "Other Person",
  avatar_url: "",
  bio: "",
  email_verified: true,
  theme_preference: "system" as const,
  created_at: "2026-01-01T00:00:00Z",
};

const conversation = {
  id: "conv-1",
  type: "dm" as const,
  participants: [other],
  last_message: {
    id: "m0",
    conversation: "conv-1",
    sender: other,
    content: "preview text",
    sent_at: "2026-01-01T00:00:00Z",
  },
  unread_count: 0,
  read_states: {},
  created_at: "2026-01-01T00:00:00Z",
};

function messagePage(results: Message[], next: string | null = null) {
  return { results, count: results.length, next, previous: null };
}

function renderChats(initialPath = "/chats") {
  useAuthStore.setState({ user: me, accessToken: "token", isInitializing: false });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:id" element={<ChatsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ChatsPage", () => {
  beforeEach(() => {
    vi.mocked(chatsApi.listConversations).mockReset().mockResolvedValue([conversation]);
    vi.mocked(chatsApi.listMessages)
      .mockReset()
      .mockResolvedValue(
        messagePage([
          {
            id: "m0",
            conversation: "conv-1",
            sender: other,
            content: "hey",
            sent_at: "2026-01-01T00:00:00Z",
          },
        ])
      );
    vi.mocked(chatsApi.sendMessage).mockReset();
    vi.mocked(wsClient.send).mockReset().mockReturnValue(true);
    useTypingStore.setState({ typingByConversation: {} });
    useReadReceiptStore.setState({ lastReadByConversation: {} });
  });

  it("lists conversations with their last-message preview", async () => {
    renderChats();
    expect(await screen.findByText("Other Person")).toBeInTheDocument();
    expect(screen.getByText("preview text")).toBeInTheDocument();
  });

  it("opens a conversation thread and can send a message over the socket", async () => {
    renderChats("/chats/conv-1");

    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalledWith("conv-1", 1));
    expect(await screen.findByText("hey")).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText("Message"), "hello there{Enter}");

    expect(wsClient.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat-message", conversation_id: "conv-1", content: "hello there" })
    );
    // Optimistic pending bubble shows immediately, before any confirmation arrives.
    expect(await screen.findByText("hello there")).toBeInTheDocument();
    expect(screen.getByText("Sending…")).toBeInTheDocument();
  });

  it("falls back to REST when the socket is not connected", async () => {
    vi.mocked(wsClient.send).mockReturnValue(false);
    vi.mocked(chatsApi.sendMessage).mockResolvedValue({
      id: "m1",
      conversation: "conv-1",
      sender: me,
      content: "via rest",
      sent_at: "2026-01-01T00:01:00Z",
      client_message_id: "whatever",
    });

    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText("Message"), "via rest{Enter}");

    await waitFor(() =>
      expect(chatsApi.sendMessage).toHaveBeenCalledWith("conv-1", "via rest", expect.any(String))
    );
  });

  it("shows a retry option when REST fallback also fails", async () => {
    vi.mocked(wsClient.send).mockReturnValue(false);
    vi.mocked(chatsApi.sendMessage).mockRejectedValue(new Error("network down"));

    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText("Message"), "oops{Enter}");

    expect(await screen.findByText(/Failed — retry/)).toBeInTheDocument();
  });

  it("shows the typing indicator with the other participant's name", async () => {
    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    useTypingStore.getState().setTyping("conv-1", other.id, true);

    expect(await screen.findByText("Other Person is typing…")).toBeInTheDocument();
  });

  it("does not show the current user as typing to themselves", async () => {
    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    useTypingStore.getState().setTyping("conv-1", me.id, true);

    expect(screen.queryByText(/is typing/)).not.toBeInTheDocument();
  });

  it("shows a read receipt once the other participant has read up to that message", async () => {
    vi.mocked(chatsApi.listMessages).mockResolvedValue(
      messagePage([
        {
          id: "m0",
          conversation: "conv-1",
          sender: me,
          content: "hi there",
          sent_at: "2026-01-01T00:00:00Z",
        },
      ])
    );
    renderChats("/chats/conv-1");
    expect(await screen.findByText("hi there")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();

    useReadReceiptStore.getState().setLastRead("conv-1", other.id, "m0");
    expect(await screen.findByText("Read")).toBeInTheDocument();
  });

  it("offers a Load older messages control when another page exists", async () => {
    vi.mocked(chatsApi.listMessages).mockResolvedValue(
      messagePage(
        [
          {
            id: "m1",
            conversation: "conv-1",
            sender: other,
            content: "newest",
            sent_at: "2026-01-02T00:00:00Z",
          },
        ],
        "http://example.com/?page=2"
      )
    );
    renderChats("/chats/conv-1");
    expect(await screen.findByText("Load older messages")).toBeInTheDocument();
  });
});

describe("ChatsPage — typing throttle and group read receipts (Phase 5 hardening)", () => {
  beforeEach(() => {
    vi.mocked(chatsApi.listConversations).mockReset().mockResolvedValue([conversation]);
    vi.mocked(chatsApi.listMessages)
      .mockReset()
      .mockResolvedValue(
        messagePage([
          {
            id: "m0",
            conversation: "conv-1",
            sender: other,
            content: "hey",
            sent_at: "2026-01-01T00:00:00Z",
          },
        ])
      );
    vi.mocked(wsClient.send).mockReset().mockReturnValue(true);
    useTypingStore.setState({ typingByConversation: {} });
    useReadReceiptStore.setState({ lastReadByConversation: {} });
  });

  it("throttles outgoing typing pings instead of sending one per keystroke", async () => {
    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Message");
    await userEvent.type(input, "hello");

    const typingSends = vi
      .mocked(wsClient.send)
      .mock.calls.filter(
        ([payload]) =>
          (payload as { type: string }).type === "typing" && (payload as { is_typing: boolean }).is_typing
      );
    // 5 keystrokes sent well within the throttle window should collapse to one ping.
    expect(typingSends.length).toBe(1);
  });

  it("seeds group read receipts from the conversation's read_states on load", async () => {
    vi.mocked(chatsApi.listMessages).mockResolvedValue(
      messagePage([
        {
          id: "m0",
          conversation: "conv-1",
          sender: me,
          content: "my message",
          sent_at: "2026-01-01T00:00:00Z",
        },
      ])
    );
    const memberB = { ...other, id: "member-b", display_name: "Member B" };
    const memberC = { ...other, id: "member-c", display_name: "Member C" };
    const groupConversation = {
      ...conversation,
      type: "group" as const,
      participants: [memberB, memberC],
      read_states: { "member-b": "m0" },
    };
    vi.mocked(chatsApi.listConversations).mockResolvedValue([groupConversation]);

    renderChats("/chats/conv-1");
    expect(await screen.findByText(/Read by 1\/2/)).toBeInTheDocument();
  });

  it("shows 'Read by everyone' once every other member has read it", async () => {
    vi.mocked(chatsApi.listMessages).mockResolvedValue(
      messagePage([
        {
          id: "m0",
          conversation: "conv-1",
          sender: me,
          content: "my message",
          sent_at: "2026-01-01T00:00:00Z",
        },
      ])
    );
    const memberB = { ...other, id: "member-b", display_name: "Member B" };
    const groupConversation = {
      ...conversation,
      type: "group" as const,
      participants: [memberB],
      read_states: {},
    };
    vi.mocked(chatsApi.listConversations).mockResolvedValue([groupConversation]);

    renderChats("/chats/conv-1");
    expect(await screen.findByText("Sent")).toBeInTheDocument();

    useReadReceiptStore.getState().setLastRead("conv-1", "member-b", "m0");
    expect(await screen.findByText(/Read by everyone/)).toBeInTheDocument();
  });
});

describe("ChatsPage — mobile layout (Phase 5 hardening: list/detail must not both show)", () => {
  beforeEach(() => {
    vi.mocked(chatsApi.listConversations).mockReset().mockResolvedValue([conversation]);
    vi.mocked(chatsApi.listMessages)
      .mockReset()
      .mockResolvedValue(
        messagePage([
          {
            id: "m0",
            conversation: "conv-1",
            sender: other,
            content: "hey",
            sent_at: "2026-01-01T00:00:00Z",
          },
        ])
      );
  });

  it("hides the entire list column (not just its items) on mobile once a conversation is active", async () => {
    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    // The list column is identified by its "Chats" heading + New button container.
    const heading = screen.getByRole("heading", { name: "Chats" });
    const listColumn = heading.closest("div")?.parentElement;
    expect(listColumn).toHaveClass("hidden");
    expect(listColumn).toHaveClass("md:flex");
    expect(listColumn).not.toHaveClass("flex");
  });

  it("shows the list column at full width and hides the detail pane when nothing is selected", async () => {
    renderChats("/chats");
    const heading = await screen.findByRole("heading", { name: "Chats" });
    const listColumn = heading.closest("div")?.parentElement;
    expect(listColumn).toHaveClass("flex");
    expect(listColumn).toHaveClass("w-full");
    expect(listColumn).not.toHaveClass("hidden");
  });

  it("shows a back button in the conversation header that returns to the full list", async () => {
    renderChats("/chats/conv-1");
    await waitFor(() => expect(chatsApi.listMessages).toHaveBeenCalled());

    const backButton = await screen.findByRole("button", { name: "Back to conversations" });
    await userEvent.click(backButton);

    // Back at /chats with no id: the list column is full-width again, not hidden.
    const heading = await screen.findByRole("heading", { name: "Chats" });
    const listColumn = heading.closest("div")?.parentElement;
    expect(listColumn).toHaveClass("flex");
    expect(listColumn).not.toHaveClass("hidden");
  });
});
