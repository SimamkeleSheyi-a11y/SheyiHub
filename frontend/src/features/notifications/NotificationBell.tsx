import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, FileText, MessageCircle, Video } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/cn";
import type { AppNotification } from "@/types/notification";

import { notificationsApi } from "./api";

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function NotificationIcon({ kind }: { kind: AppNotification["kind"] }) {
  const cls = "size-4";
  if (kind === "message") return <MessageCircle className={cls} />;
  if (kind === "file_shared") return <FileText className={cls} />;
  return <Video className={cls} />;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
  });
  const listQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(false),
    enabled: open,
  });

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

  const unreadCount = countQuery.data?.count ?? 0;
  const notifications = listQuery.data?.results.slice(0, 8) ?? [];

  async function openNotification(notification: AppNotification) {
    if (!notification.is_read) await markRead.mutateAsync(notification.id);
    setOpen(false);
    if (notification.target_url) navigate(notification.target_url);
  }

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-9 place-items-center rounded-[10px] text-(--text-secondary) transition-colors hover:bg-ember/8 hover:text-(--text-primary)"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-rust px-1 text-[10px] font-semibold leading-4 text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="premium-panel absolute right-0 z-40 mt-2 w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-[16px] shadow-[var(--shadow-elevation-4)]"
        >
          <div className="flex items-center justify-between border-b border-(--border) px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-(--text-primary)">Notifications</p>
              <p className="text-xs text-(--text-secondary)">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 ? (
              <button
                onClick={() => markAll.mutate()}
                className="flex items-center gap-1 text-[10px] font-semibold text-ember hover:underline"
              >
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            ) : null}
          </div>

          <div className="soft-scrollbar max-h-[390px] overflow-y-auto">
            {listQuery.isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-(--text-secondary)">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-(--text-secondary)">You're all caught up.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  role="menuitem"
                  onClick={() => openNotification(notification)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-(--border) px-4 py-3 text-left last:border-b-0 hover:bg-ember/[0.045]",
                    !notification.is_read && "bg-ember/5"
                  )}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-ember/12 bg-ember/9 text-ember">
                    <NotificationIcon kind={notification.kind} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-(--text-primary)">{notification.title}</span>
                    {notification.body ? (
                      <span className="mt-0.5 block truncate text-xs text-(--text-secondary)">{notification.body}</span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-(--text-secondary)">{relativeTime(notification.created_at)}</span>
                  </span>
                  {!notification.is_read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-ember" /> : null}
                </button>
              ))
            )}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
            className="w-full border-t border-(--border) px-4 py-3 text-center text-[10px] font-semibold text-ember hover:bg-ember/[0.045]"
          >
            View all notifications
          </button>
        </div>
      ) : null}
    </div>
  );
}
