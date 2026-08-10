import { create } from "zustand";

interface TypingState {
  typingByConversation: Record<string, Set<string>>;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
}

// Receiver-side TTL: if a "still typing" refresh doesn't arrive within this
// window, the indicator clears itself — covers a tab closing, a connection
// dropping, or any other case where an explicit "stopped" signal never
// arrives (Phase 5 hardening). Backend's own TTL is 5s; this is a touch
// shorter so the client-side timeout isn't racing the server's.
const EXPIRY_MS = 4500;

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(conversationId: string, userId: string) {
  return `${conversationId}:${userId}`;
}

export const useTypingStore = create<TypingState>((set, get) => ({
  typingByConversation: {},
  setTyping: (conversationId, userId, isTyping) => {
    const key = timerKey(conversationId, userId);
    const existing = expiryTimers.get(key);
    if (existing) clearTimeout(existing);
    expiryTimers.delete(key);

    set((state) => {
      const current = new Set(state.typingByConversation[conversationId] ?? []);
      if (isTyping) current.add(userId);
      else current.delete(userId);
      return { typingByConversation: { ...state.typingByConversation, [conversationId]: current } };
    });

    if (isTyping) {
      expiryTimers.set(
        key,
        setTimeout(() => get().setTyping(conversationId, userId, false), EXPIRY_MS)
      );
    }
  },
}));
