import { create } from "zustand";

interface ReadReceiptState {
  // conversationId -> { userId -> last message id that user has read }
  lastReadByConversation: Record<string, Record<string, string>>;
  setLastRead: (conversationId: string, userId: string, messageId: string) => void;
}

export const useReadReceiptStore = create<ReadReceiptState>((set) => ({
  lastReadByConversation: {},
  setLastRead: (conversationId, userId, messageId) =>
    set((state) => ({
      lastReadByConversation: {
        ...state.lastReadByConversation,
        [conversationId]: { ...state.lastReadByConversation[conversationId], [userId]: messageId },
      },
    })),
}));
