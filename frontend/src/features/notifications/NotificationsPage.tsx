import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, FileText, MessageCircle, Radio, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { ApiError } from "@/lib/apiClient";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toastStore";
import type { AppNotification } from "@/types/notification";
import { notificationsApi } from "./api";

function iconFor(kind: AppNotification["kind"]) {
  if (kind === "message") return MessageCircle;
  if (kind === "file_shared") return FileText;
  if (kind === "meeting_started") return Radio;
  return Video;
}

function relativeTime(value: string) {
  const m = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list(false) });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't update that notification."),
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notification-unread-count"] });
      toast.success("Notifications marked as read.");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Couldn't mark notifications as read."),
  });

  const notifications = useMemo(() => query.data?.results ?? [], [query.data]);
  const visible = useMemo(
    () => (filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications),
    [filter, notifications]
  );
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function openNotification(n: AppNotification) {
    if (!n.is_read) await markRead.mutateAsync(n.id);
    if (n.target_url) navigate(n.target_url);
  }

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-4 pb-2 sm:gap-5">
      <section className="relative overflow-hidden rounded-[18px] border border-(--border) bg-(--surface-raised) p-4 shadow-[var(--shadow-elevation-1)] sm:p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-ember/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember">
              <Bell className="size-3.5" /> Activity center
            </div>
            <h1 className="font-display text-[24px] font-semibold tracking-[-0.045em] sm:text-[28px]">Notifications</h1>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-(--text-secondary) sm:text-xs">
              Messages, meetings and shared activity that need your attention.
            </p>
          </div>
          <Button
            className="w-full sm:w-auto"
            variant="secondary"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unreadCount === 0}
          >
            <CheckCheck className="size-4" /> Mark all read
          </Button>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-[13px] border border-(--border) bg-(--surface-soft)/70 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-(--text-secondary)">Unread</p>
            <p className="mt-1 font-display text-xl font-semibold">{unreadCount}</p>
          </div>
          <div className="rounded-[13px] border border-(--border) bg-(--surface-soft)/70 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-(--text-secondary)">All activity</p>
            <p className="mt-1 font-display text-xl font-semibold">{notifications.length}</p>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-(--border) px-3 py-3 sm:px-4">
          <div className="flex gap-1 rounded-[10px] bg-(--surface-soft) p-1">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                "min-h-9 rounded-[8px] px-3 py-1.5 text-[10px] font-semibold",
                filter === "all" ? "bg-(--surface-raised) shadow-sm" : "text-(--text-secondary)"
              )}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={cn(
                "min-h-9 rounded-[8px] px-3 py-1.5 text-[10px] font-semibold",
                filter === "unread" ? "bg-(--surface-raised) shadow-sm" : "text-(--text-secondary)"
              )}
            >
              Unread {unreadCount ? `(${unreadCount})` : ""}
            </button>
          </div>
          <span className="hidden text-[10px] text-(--text-secondary) sm:inline">{visible.length} shown</span>
        </div>

        {query.isLoading ? (
          <div className="space-y-2 p-3 sm:p-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : visible.length ? (
          <div className="divide-y divide-(--border)">
            {visible.map((n) => {
              const Icon = iconFor(n.kind);
              return (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={cn(
                    "group flex w-full items-start gap-2.5 px-3 py-3.5 text-left transition-colors sm:gap-3 sm:px-5 sm:py-4",
                    !n.is_read ? "bg-ember/[0.045] hover:bg-ember/[0.075]" : "hover:bg-ember/[0.035]"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-9 shrink-0 place-items-center rounded-[11px] border sm:size-10 sm:rounded-[12px]",
                      !n.is_read
                        ? "border-ember/16 bg-ember/10 text-ember"
                        : "border-(--border) bg-(--surface-soft) text-(--text-secondary)"
                    )}
                  >
                    <Icon className="size-4 sm:size-[17px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className={cn("min-w-0 flex-1 text-[11px] sm:text-xs", !n.is_read ? "font-semibold" : "font-medium")}>{n.title}</span>
                      <span className="shrink-0 text-[8.5px] text-(--text-secondary) sm:text-[9px]">{relativeTime(n.created_at)}</span>
                    </span>
                    {n.body ? <span className="mt-1 block text-[9.5px] leading-4.5 text-(--text-secondary) sm:text-[10px] sm:leading-5">{n.body}</span> : null}
                    {n.actor_name ? <span className="mt-1.5 block text-[9px] font-medium text-ember">From {n.actor_name}</span> : null}
                  </span>
                  {!n.is_read ? <span className="mt-2 size-2 shrink-0 rounded-full bg-ember" /> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center sm:min-h-64">
            <span className="grid size-12 place-items-center rounded-[15px] bg-ember/10 text-ember">
              <CheckCheck className="size-5" />
            </span>
            <p className="mt-4 text-sm font-semibold">{filter === "unread" ? "You're all caught up" : "No notifications yet"}</p>
            <p className="mt-1 text-[10px] text-(--text-secondary)">New collaboration activity will appear here.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
