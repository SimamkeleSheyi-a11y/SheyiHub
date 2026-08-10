import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";
import type { AppNotification } from "@/types/notification";

import { notificationsApi } from "./api";

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list(false) });
  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });
  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
  });

  async function openNotification(notification: AppNotification) {
    if (!notification.is_read) await markRead.mutateAsync(notification.id);
    if (notification.target_url) navigate(notification.target_url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--text-primary)">Notifications</h1>
          <p className="mt-1 text-sm text-(--text-secondary)">Messages, meeting activity and shared files.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          <CheckCheck className="size-4" /> Mark all read
        </Button>
      </div>

      <Card className="p-0">
        {query.isLoading ? (
          <p className="p-6 text-sm text-(--text-secondary)">Loading notifications…</p>
        ) : query.data?.results.length ? (
          query.data.results.map((notification) => (
            <button
              key={notification.id}
              onClick={() => openNotification(notification)}
              className={cn(
                "flex w-full items-start gap-3 border-b border-(--border) p-4 text-left last:border-b-0 hover:bg-stone-50 dark:hover:bg-white/5",
                !notification.is_read && "bg-ember/5"
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium text-(--text-primary)">{notification.title}</span>
                {notification.body ? <span className="mt-1 block text-sm text-(--text-secondary)">{notification.body}</span> : null}
                <span className="mt-1 block text-xs text-(--text-secondary)">
                  {new Date(notification.created_at).toLocaleString()}
                </span>
              </span>
              {!notification.is_read ? <span className="mt-2 size-2 rounded-full bg-ember" /> : null}
            </button>
          ))
        ) : (
          <p className="p-8 text-center text-sm text-(--text-secondary)">No notifications yet.</p>
        )}
      </Card>
    </div>
  );
}
