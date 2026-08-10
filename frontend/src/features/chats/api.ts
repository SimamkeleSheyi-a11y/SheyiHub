import { apiFetch } from "@/lib/apiClient";
import type { Conversation, Message } from "@/types/messaging";

interface Paginated<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

export const chatsApi = {
  listConversations: () => apiFetch<Paginated<Conversation> | Conversation[]>("/conversations/"),

  startConversation: (participantEmails: string[]) =>
    apiFetch<Conversation>("/conversations/", {
      method: "POST",
      body: { participant_emails: participantEmails },
    }),

  listMessages: (conversationId: string, page = 1) =>
    apiFetch<Paginated<Message> | Message[]>(`/conversations/${conversationId}/messages?page=${page}`),

  sendMessage: (conversationId: string, content: string, clientMessageId?: string) =>
    apiFetch<Message>(`/conversations/${conversationId}/messages/send`, {
      method: "POST",
      body: { content, client_message_id: clientMessageId },
    }),
};
