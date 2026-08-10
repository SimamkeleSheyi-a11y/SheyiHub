import type { User } from "./user";

export type ConversationType = "dm" | "group" | "meeting";

export interface Message {
  id: string;
  conversation: string;
  sender: User;
  content: string;
  sent_at: string;
  client_message_id?: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: User[];
  last_message: Message | null;
  unread_count: number;
  read_states: Record<string, string>; // other participant's user id -> their last-read message id
  created_at: string;
}

export type PresenceStatus = "online" | "offline";
