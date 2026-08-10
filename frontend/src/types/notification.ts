export type NotificationKind =
  | "message"
  | "meeting_invite"
  | "meeting_response"
  | "meeting_started"
  | "file_shared";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  target_url: string;
  actor_name: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  messages_enabled: boolean;
  meetings_enabled: boolean;
  files_enabled: boolean;
  browser_enabled: boolean;
}
