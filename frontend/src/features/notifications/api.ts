import { apiFetch } from "@/lib/apiClient";
import type { AppNotification, NotificationPreferences } from "@/types/notification";

export interface NotificationPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: AppNotification[];
}

export const notificationsApi = {
  list: (unread = false) =>
    apiFetch<NotificationPage>(`/notifications/${unread ? "?unread=1" : ""}`),

  unreadCount: () => apiFetch<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) =>
    apiFetch<void>(`/notifications/${id}/read`, { method: "POST" }),

  markAllRead: () =>
    apiFetch<{ updated: number }>("/notifications/mark-all-read", { method: "POST" }),

  preferences: () => apiFetch<NotificationPreferences>("/notifications/preferences"),

  updatePreferences: (data: Partial<NotificationPreferences>) =>
    apiFetch<NotificationPreferences>("/notifications/preferences", {
      method: "PATCH",
      body: data,
    }),
};
