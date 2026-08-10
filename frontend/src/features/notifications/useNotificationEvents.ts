import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { wsClient } from "@/lib/wsClient";
import { toast } from "@/stores/toastStore";
import type { AppNotification } from "@/types/notification";

import { notificationsApi } from "./api";

function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function useNotificationEvents() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const preferencesQuery = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: notificationsApi.preferences,
    staleTime: 60_000,
  });

  useEffect(
    () =>
      wsClient.on("notification.created", (event) => {
        const notification = event.notification as AppNotification | undefined;
        if (!notification) return;

        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });

        if (!document.hidden) {
          toast.info(notification.title);
          return;
        }

        const browserEnabled = preferencesQuery.data?.browser_enabled ?? false;
        if (!browserEnabled || !canUseBrowserNotifications() || Notification.permission !== "granted") return;

        const browserNotification = new Notification(notification.title, {
          body: notification.body || undefined,
          tag: `sheyihub-${notification.id}`,
        });
        browserNotification.onclick = () => {
          window.focus();
          browserNotification.close();
          if (notification.target_url) navigate(notification.target_url);
        };
      }),
    [navigate, preferencesQuery.data?.browser_enabled, queryClient]
  );
}
