import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bell,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  MessageCircleMore,
  Plus,
  Sparkles,
  UsersRound,
  Video,
  Building2,
  CheckSquare2,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PresenceDot } from "@/components/PresenceDot";
import { Skeleton } from "@/components/Skeleton";
import { chatsApi } from "@/features/chats/api";
import { meetingsApi } from "@/features/meetings/api";
import { notificationsApi } from "@/features/notifications/api";
import { tasksApi } from "@/features/tasks/api";
import { workspacesApi } from "@/features/workspaces/api";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { toast } from "@/stores/toastStore";
import { usePresenceStore } from "@/stores/presenceStore";
import type { Conversation } from "@/types/messaging";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function shortTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function relativeMeeting(value: string) {
  const diffMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60_000);
  if (diffMinutes <= 0 && diffMinutes > -60) return "Starting now";
  if (diffMinutes < 60 && diffMinutes > 0) return `in ${diffMinutes} min`;
  if (diffMinutes < 24 * 60 && diffMinutes > 0) return `in ${Math.round(diffMinutes / 60)} hr`;
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function conversationLabel(conversation: Conversation) {
  return conversation.type === "group"
    ? conversation.participants.map((participant) => participant.display_name).join(", ") ||
        "Group conversation"
    : (conversation.participants[0]?.display_name ?? "Conversation");
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const statuses = usePresenceStore((s) => s.statuses);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId);

  const workspacesQuery = useQuery({ queryKey: ["workspaces"], queryFn: workspacesApi.list, retry: false });
  const workspaces = Array.isArray(workspacesQuery.data) ? workspacesQuery.data : (workspacesQuery.data?.results ?? []);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  useEffect(() => {
    if (!activeWorkspaceId && activeWorkspace) setActiveWorkspaceId(activeWorkspace.id);
  }, [activeWorkspace, activeWorkspaceId, setActiveWorkspaceId]);
  const tasksQuery = useQuery({ queryKey: ["tasks", activeWorkspace?.id], queryFn: () => tasksApi.list(activeWorkspace!.id), enabled: !!activeWorkspace, retry: false });
  const workspaceTasks = Array.isArray(tasksQuery.data) ? tasksQuery.data : (tasksQuery.data?.results ?? []);

  const meetingsQuery = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: () => meetingsApi.list("upcoming"),
  });
  const conversationsQuery = useQuery({
    queryKey: ["conversations"],
    queryFn: chatsApi.listConversations,
    refetchInterval: 30_000,
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(false),
  });
  const unreadNotificationsQuery = useQuery({
    queryKey: ["notification-unread-count"],
    queryFn: notificationsApi.unreadCount,
  });

  const startInstantMeeting = useMutation({
    mutationFn: () => {
      const now = new Date();
      return meetingsApi.create({
        title: `${user?.display_name || "SheyiHub"}'s meeting`,
        scheduled_start: new Date(now.getTime() + 60_000).toISOString(),
        scheduled_end: new Date(now.getTime() + 60 * 60_000).toISOString(),
      });
    },
    onSuccess: (meeting) => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting created. Opening room…");
      navigate(`/meetings/${meeting.id}/room`);
    },
    onError: (error) => {
      if (error instanceof ApiError && (error.status === 403 || error.code === "email_not_verified")) {
        toast.error("Verify your email before starting a meeting.");
        navigate("/verify-email", { state: { email: user?.email } });
        return;
      }
      toast.error(error instanceof ApiError ? error.message : "Couldn't start the meeting.");
    },
  });

  const meetings = Array.isArray(meetingsQuery.data)
    ? meetingsQuery.data
    : (meetingsQuery.data?.results ?? []);
  const conversations: Conversation[] = Array.isArray(conversationsQuery.data)
    ? conversationsQuery.data
    : (conversationsQuery.data?.results ?? []);
  const notifications = notificationsQuery.data?.results ?? [];
  const unreadMessages = conversations.reduce((total, conversation) => total + conversation.unread_count, 0);
  const participantIds = new Set(
    conversations.flatMap((conversation) => conversation.participants.map((participant) => participant.id))
  );
  const onlinePeople = [...participantIds].filter((id) => statuses[id]?.status === "online").length;
  const nextMeeting = meetings[0];
  const firstName = user?.display_name?.trim().split(/\s+/)[0] || "there";

  const stats = [
    {
      label: "Unread",
      value: unreadMessages,
      note: unreadMessages ? "Messages waiting" : "All caught up",
      icon: MessageCircleMore,
      route: "/chats",
    },
    {
      label: "Meetings",
      value: meetings.length,
      note: nextMeeting ? relativeMeeting(nextMeeting.scheduled_start) : "Nothing scheduled",
      icon: CalendarClock,
      route: "/meetings",
    },
    {
      label: "Online",
      value: onlinePeople,
      note: participantIds.size ? `${participantIds.size} collaborators` : "Meet someone new",
      icon: UsersRound,
      route: "/chats",
    },
    {
      label: "Activity",
      value: unreadNotificationsQuery.data?.count ?? 0,
      note: "Unread updates",
      icon: Bell,
      route: "/notifications",
    },
  ];

  const loading = meetingsQuery.isLoading || conversationsQuery.isLoading;
  const hasCoreError = meetingsQuery.isError && conversationsQuery.isError;
  const isFreshWorkspace =
    !loading && conversations.length === 0 && meetings.length === 0 && notifications.length === 0;

  return (
    <div className="flex flex-col gap-4 pb-2 sm:gap-5 lg:gap-6">
      <section className="relative overflow-hidden rounded-[18px] border border-(--border) bg-(--surface-raised) px-4 py-4 shadow-[var(--shadow-elevation-1)] sm:px-6 sm:py-5 lg:px-7">
        <div className="pointer-events-none absolute -right-14 -top-28 size-64 rounded-full bg-[#8158ff]/12 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-[38%] h-px w-48 bg-gradient-to-r from-transparent via-ember/30 to-transparent" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember">
              <Sparkles className="size-3.5" />
              Workspace pulse
            </div>
            <h1 className="truncate font-display text-[24px] font-semibold tracking-[-0.045em] sm:text-[30px]">
              {greeting()}, {firstName} <span aria-hidden>👋</span>
            </h1>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-(--text-secondary) sm:text-sm sm:leading-6">
              Your conversations, meetings and team activity — together in one place.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={() => navigate("/meetings/schedule")}
            >
              <CalendarPlus className="size-4" />
              Schedule
            </Button>
            <Button
              className="w-full sm:w-auto"
              onClick={() => { if (!user?.email_verified) { toast.error("Verify your email before starting a meeting."); navigate("/verify-email", { state: { email: user?.email } }); return; } startInstantMeeting.mutate(); }}
              isLoading={startInstantMeeting.isPending}
            >
              <Video className="size-4" />
              Start meeting
            </Button>
          </div>
        </div>
      </section>

      {hasCoreError ? (
        <ErrorBanner message="Some workspace data couldn't be loaded. Try refreshing the page." />
      ) : null}

      <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-4 xl:gap-3">
        {loading
          ? [0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-[104px] rounded-[15px] sm:h-[116px]" />
            ))
          : stats.map(({ label, value, note, icon: Icon, route }) => (
              <button
                type="button"
                key={label}
                onClick={() => navigate(route)}
                className="premium-panel group relative min-w-0 overflow-hidden rounded-[15px] p-3.5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-ember/35 sm:p-4.5"
              >
                <div className="absolute right-0 top-0 size-20 translate-x-6 -translate-y-6 rounded-full bg-ember/7 blur-2xl" />
                <div className="relative flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium text-(--text-secondary) sm:text-[11px]">
                      {label}
                    </p>
                    <p className="mt-1.5 font-display text-[24px] font-semibold tracking-[-0.045em] sm:mt-2 sm:text-[28px]">
                      {value}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-(--text-secondary) sm:mt-1 sm:text-[10px]">
                      {note}
                    </p>
                  </div>
                  <span className="grid size-8 shrink-0 place-items-center rounded-[10px] border border-ember/12 bg-ember/9 text-ember sm:size-9 sm:rounded-[11px]">
                    <Icon className="size-4 sm:size-[17px]" />
                  </span>
                </div>
              </button>
            ))}
      </section>

      {isFreshWorkspace ? (
        <section className="premium-panel relative overflow-hidden rounded-[18px] p-4 sm:p-5">
          <div className="pointer-events-none absolute -left-12 -top-16 size-44 rounded-full bg-ember/10 blur-3xl" />
          <div className="relative grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ember/15 bg-ember/8 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-ember">
                <Sparkles className="size-3" /> New workspace
              </span>
              <h2 className="mt-3 font-display text-lg font-semibold tracking-[-0.03em] sm:text-xl">
                Make SheyiHub yours.
              </h2>
              <p className="mt-1 max-w-xl text-[11px] leading-5 text-(--text-secondary) sm:text-xs">
                Start a conversation or schedule your first meeting. Your dashboard will fill itself with real
                activity as your workspace grows.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button className="w-full" variant="secondary" onClick={() => navigate(workspaces.length ? "/chats" : "/onboarding")}>
                {workspaces.length ? <MessageCircleMore className="size-4" /> : <Building2 className="size-4" />} {workspaces.length ? "Start chat" : "Set up"}
              </Button>
              <Button className="w-full" onClick={() => navigate("/meetings/schedule")}>
                <CalendarPlus className="size-4" /> Plan meeting
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid min-h-[300px] gap-3 lg:grid-cols-[1.1fr_.9fr] lg:gap-4">
        <Card className="min-w-0 overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-(--border) px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold">Recent conversations</h2>
              <p className="mt-0.5 truncate text-[10px] text-(--text-secondary)">
                Pick up where your team left off.
              </p>
            </div>
            <button
              onClick={() => navigate("/chats")}
              className="ml-3 shrink-0 text-[10px] font-semibold text-ember hover:underline sm:text-[11px]"
            >
              View all
            </button>
          </div>
          <div className="divide-y divide-(--border)">
            {conversationsQuery.isLoading ? (
              <div className="space-y-3 p-4">
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
                <Skeleton className="h-14" />
              </div>
            ) : conversations.length ? (
              conversations.slice(0, 5).map((conversation) => {
                const person = conversation.participants[0];
                return (
                  <button
                    key={conversation.id}
                    onClick={() => navigate(`/chats/${conversation.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ember/[0.045] sm:px-5"
                  >
                    <div className="relative shrink-0">
                      <Avatar name={conversationLabel(conversation)} src={person?.avatar_url} size="md" />
                      {conversation.type === "dm" && person ? (
                        <PresenceDot userId={person.id} className="absolute -bottom-0.5 -right-0.5" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold">{conversationLabel(conversation)}</p>
                        {conversation.unread_count ? (
                          <span className="rounded-full bg-ember px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {conversation.unread_count}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-[10px] text-(--text-secondary)">
                        {conversation.last_message?.content || "No messages yet"}
                      </p>
                    </div>
                    {conversation.last_message ? (
                      <span className="shrink-0 text-[9px] text-(--text-secondary)">
                        {shortTime(conversation.last_message.sent_at)}
                      </span>
                    ) : null}
                  </button>
                );
              })
            ) : (
              <div className="flex flex-col items-center px-5 py-8 text-center sm:py-10">
                <MessageCircleMore className="size-6 text-ember" />
                <p className="mt-3 text-xs font-semibold">No conversations yet</p>
                <p className="mt-1 text-[10px] text-(--text-secondary)">
                  Start a chat and it will appear here.
                </p>
                <Button className="mt-4" size="sm" variant="secondary" onClick={() => navigate("/chats")}>
                  <Plus className="size-3.5" /> Start chat
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-(--border) px-4 py-3.5 sm:px-5 sm:py-4">
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold">Up next</h2>
              <p className="mt-0.5 truncate text-[10px] text-(--text-secondary)">
                Your nearest scheduled meeting.
              </p>
            </div>
            <button
              onClick={() => navigate("/meetings")}
              className="ml-3 shrink-0 text-[10px] font-semibold text-ember hover:underline sm:text-[11px]"
            >
              Meetings
            </button>
          </div>
          {meetingsQuery.isLoading ? (
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-28" />
              <Skeleton className="h-10" />
            </div>
          ) : nextMeeting ? (
            <div className="p-4 sm:p-5">
              <div className="relative overflow-hidden rounded-[15px] border border-ember/15 bg-gradient-to-br from-ember/[0.12] to-transparent p-4 sm:p-5">
                <span className="inline-flex rounded-full border border-ember/20 bg-ember/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-ember">
                  {relativeMeeting(nextMeeting.scheduled_start)}
                </span>
                <h3 className="mt-3 line-clamp-2 font-display text-base font-semibold tracking-[-0.03em] sm:mt-4 sm:text-lg">
                  {nextMeeting.title}
                </h3>
                <div className="mt-2 flex flex-col gap-1.5 text-[10px] text-(--text-secondary) sm:flex-row sm:flex-wrap sm:gap-x-4">
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" />
                    {new Date(nextMeeting.scheduled_start).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <UsersRound className="size-3.5 shrink-0" />
                    <span className="truncate">Hosted by {nextMeeting.host.display_name}</span>
                  </span>
                </div>
                <Button
                  className="mt-4 w-full sm:mt-5"
                  size="sm"
                  onClick={() => navigate(`/meetings/${nextMeeting.id}`)}
                >
                  <Video className="size-3.5" /> Open meeting
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-(--border) bg-(--surface-soft) px-3 py-2.5 text-[10px] text-(--text-secondary) sm:mt-4">
                <CheckCircle2 className="size-4 shrink-0 text-signal" />
                Your workspace is synced and ready.
              </div>
            </div>
          ) : (
            <div className="flex min-h-[210px] flex-col items-center justify-center px-6 py-8 text-center sm:min-h-[240px]">
              <CalendarClock className="size-7 text-ember" />
              <p className="mt-3 text-xs font-semibold">Your calendar is clear</p>
              <p className="mt-1 text-[10px] text-(--text-secondary)">
                Schedule a meeting when you're ready.
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="secondary"
                onClick={() => navigate("/meetings/schedule")}
              >
                <CalendarPlus className="size-3.5" /> Schedule
              </Button>
            </div>
          )}
        </Card>
      </section>

      <section>
        <div className="mb-2.5">
          <h2 className="font-display text-sm font-semibold">Quick actions</h2>
          <p className="mt-0.5 text-[11px] text-(--text-secondary)">Jump straight into your next move.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            ["New message", "Talk to your team", MessageCircleMore, () => navigate("/chats")],
            ["Instant meeting", "Open a room now", Video, () => startInstantMeeting.mutate()],
            ["Schedule", "Plan time together", CalendarPlus, () => navigate("/meetings/schedule")],
            ["Activity", "Review updates", Activity, () => navigate("/notifications")],
          ].map(([title, note, Icon, action]) => {
            const IconComp = Icon as typeof MessageCircleMore;
            return (
              <button
                key={String(title)}
                onClick={action as () => void}
                className="premium-panel group flex min-h-[82px] min-w-0 flex-col items-start gap-2 rounded-[14px] px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-ember/35 sm:min-h-0 sm:flex-row sm:items-center sm:gap-3 sm:px-4"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-ember/10 text-ember sm:size-9 sm:rounded-[10px]">
                  <IconComp className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold sm:text-xs">{String(title)}</span>
                  <span className="mt-0.5 hidden truncate text-[10px] text-(--text-secondary) sm:block">
                    {String(note)}
                  </span>
                </span>
                <ArrowRight className="hidden size-3.5 shrink-0 text-(--text-secondary) transition group-hover:translate-x-0.5 group-hover:text-ember sm:block" />
              </button>
            );
          })}
        </div>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-(--border) px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold">Activity feed</h2>
            <p className="mt-0.5 truncate text-[10px] text-(--text-secondary)">
              Recent updates across SheyiHub.
            </p>
          </div>
          <button
            onClick={() => navigate("/notifications")}
            className="ml-3 shrink-0 text-[10px] font-semibold text-ember hover:underline sm:text-[11px]"
          >
            View all
          </button>
        </div>
        {notificationsQuery.isLoading ? (
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : notifications.length ? (
          <div className="divide-y divide-(--border) md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
            {notifications.slice(0, 3).map((notification) => (
              <button
                key={notification.id}
                onClick={() => notification.target_url && navigate(notification.target_url)}
                className="flex min-w-0 items-start gap-3 px-4 py-3.5 text-left hover:bg-ember/[0.045] sm:px-5 sm:py-4"
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] bg-ember/10 text-ember">
                  <Activity className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold">{notification.title}</span>
                  <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-(--text-secondary)">
                    {notification.body}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 px-5 py-6 text-xs text-(--text-secondary) sm:py-7">
            <CheckCircle2 className="size-4 text-signal" /> You're all caught up.
          </div>
        )}
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        <button type="button" onClick={() => navigate("/workspaces")} className="premium-panel flex items-center gap-3 rounded-[15px] p-4 text-left transition hover:border-ember/30">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ember/10 text-ember"><Building2 className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{activeWorkspace?.name ?? "Set up a workspace"}</span><span className="mt-1 block text-[9px] text-(--text-secondary)">{activeWorkspace ? `${activeWorkspace.member_count} members · ${activeWorkspace.role}` : "Create a team space for projects and tasks"}</span></span><ArrowRight className="size-4 text-(--text-secondary)" />
        </button>
        <button type="button" onClick={() => navigate(activeWorkspace ? "/tasks" : "/onboarding")} className="premium-panel flex items-center gap-3 rounded-[15px] p-4 text-left transition hover:border-ember/30">
          <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-ember/10 text-ember"><CheckSquare2 className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs font-semibold">Workspace tasks</span><span className="mt-1 block text-[9px] text-(--text-secondary)">{activeWorkspace ? `${workspaceTasks.filter((task) => task.status !== "done").length} open · ${workspaceTasks.filter((task) => task.status === "done").length} done` : "Create a workspace to start organising work"}</span></span><ArrowRight className="size-4 text-(--text-secondary)" />
        </button>
      </section>
    </div>
  );
}
