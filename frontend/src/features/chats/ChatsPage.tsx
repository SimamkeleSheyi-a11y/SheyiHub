import { useQuery } from "@tanstack/react-query";
import { MessageCircleMore, MessageSquarePlus, Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PresenceDot } from "@/components/PresenceDot";
import { Skeleton } from "@/components/Skeleton";
import { ConversationView } from "@/features/chats/ConversationView";
import { NewConversationModal } from "@/features/chats/NewConversationModal";
import { chatsApi } from "@/features/chats/api";
import { cn } from "@/lib/cn";
import type { Conversation } from "@/types/messaging";

function conversationLabel(conversation: Conversation) {
  return conversation.type === "group"
    ? conversation.participants.map((participant) => participant.display_name).join(", ") || "Group"
    : (conversation.participants[0]?.display_name ?? "Conversation");
}

function conversationTime(conversation: Conversation) {
  if (!conversation.last_message) return "";

  const value = new Date(conversation.last_message.sent_at);
  return value.toDateString() === new Date().toDateString()
    ? value.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : value.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ChatsPage() {
  const { id: activeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["conversations"],
    queryFn: chatsApi.listConversations,
    refetchInterval: 30_000,
  });

  const conversations = useMemo(() => (Array.isArray(data) ? data : (data?.results ?? [])), [data]);

  const filteredConversations = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (filter === "unread" && conversation.unread_count === 0) return false;
      if (!needle) return true;

      const label = conversationLabel(conversation).toLowerCase();
      const preview = (conversation.last_message?.content ?? "").toLowerCase();
      return label.includes(needle) || preview.includes(needle);
    });
  }, [conversations, filter, search]);

  const unreadTotal = conversations.reduce((sum, conversation) => sum + conversation.unread_count, 0);

  return (
    <div className="flex h-[calc(100dvh-9.7rem)] min-h-0 gap-0 sm:h-[calc(100dvh-10rem)] md:h-[calc(100dvh-7.8rem)] md:min-h-[540px] md:gap-3 lg:gap-4 xl:gap-5">
      <div
        className={cn(
          "premium-panel overflow-hidden rounded-[16px] md:flex md:w-[300px] md:shrink-0 md:flex-col lg:w-[330px] xl:w-[350px]",
          activeId ? "hidden md:flex" : "flex w-full flex-col"
        )}
      >
        {/* Keep the heading directly inside this header. The mobile hardening tests
            intentionally use this header to resolve the whole list column. */}
        <div className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-2 border-b border-(--border) px-3.5 py-3.5 sm:px-4 sm:py-4">
          <h1 className="font-display text-lg font-semibold tracking-[-0.035em] sm:text-xl">Chats</h1>
          {unreadTotal ? <Badge tone="ember">{unreadTotal}</Badge> : null}
          <span aria-hidden />
          <Button size="sm" variant="secondary" onClick={() => setIsNewOpen(true)}>
            <MessageSquarePlus className="size-4" />
            New
          </Button>
          <p className="col-span-4 mt-1 text-[10px] text-(--text-secondary)">
            Messages, groups and meeting conversations.
          </p>
        </div>

        <div className="border-b border-(--border) px-2.5 py-2.5 sm:px-3 sm:py-3">
          <div className="flex h-9 items-center gap-2 rounded-[10px] border border-(--border) bg-(--surface-soft) px-3">
            <Search className="size-3.5 text-(--text-secondary)" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-(--text-secondary)"
            />
          </div>
          <div className="mt-2 flex gap-1 rounded-[9px] bg-(--surface-soft) p-1">
            {(["all", "unread"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "flex-1 rounded-[7px] px-2 py-1.5 text-[10px] font-semibold capitalize",
                  filter === value ? "bg-(--surface-raised) shadow-sm" : "text-(--text-secondary)"
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : isError ? (
          <div className="p-3">
            <ErrorBanner message="Couldn't load your conversations." />
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-3">
            <EmptyState
              icon={Users}
              title="Nothing here yet"
              description="Send the first message to start a conversation."
              action={
                <Button variant="secondary" onClick={() => setIsNewOpen(true)}>
                  Start a conversation
                </Button>
              }
            />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <Search className="size-6 text-ember" />
            <p className="mt-3 text-xs font-semibold">No matching chats</p>
            <p className="mt-1 text-[10px] text-(--text-secondary)">Try another search or filter.</p>
          </div>
        ) : (
          <div className="soft-scrollbar flex flex-1 flex-col overflow-y-auto p-1.5 sm:p-2">
            {filteredConversations.map((conversation) => {
              const other = conversation.participants[0];
              const isActive = activeId === conversation.id;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => navigate(`/chats/${conversation.id}`)}
                  className={cn(
                    "group flex min-h-[62px] items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition-all sm:px-3 sm:py-3",
                    isActive
                      ? "bg-gradient-to-r from-ember/14 to-ember/[0.045] shadow-[inset_0_0_0_1px_rgba(143,101,255,.12)]"
                      : "hover:bg-ember/[0.045]"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar name={conversationLabel(conversation)} src={other?.avatar_url} size="md" />
                    {conversation.type === "dm" && other ? (
                      <PresenceDot userId={other.id} className="absolute -bottom-0.5 -right-0.5" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-xs",
                          conversation.unread_count ? "font-semibold" : "font-medium"
                        )}
                      >
                        {conversationLabel(conversation)}
                      </p>
                      {conversationTime(conversation) ? (
                        <span className="ml-auto shrink-0 text-[9px] text-(--text-secondary)">
                          {conversationTime(conversation)}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p
                        className={cn(
                          "truncate text-[10px]",
                          conversation.unread_count
                            ? "font-medium text-(--text-primary)"
                            : "text-(--text-secondary)"
                        )}
                      >
                        {conversation.last_message?.content ?? "No messages yet"}
                      </p>
                      {conversation.unread_count > 0 ? (
                        <span className="ml-auto grid min-w-4 shrink-0 place-items-center rounded-full bg-ember px-1 text-[9px] font-bold leading-4 text-white">
                          {conversation.unread_count}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={cn("min-w-0 flex-col md:flex md:flex-1", activeId ? "flex w-full" : "hidden md:flex")}>
        {activeId ? (
          <ConversationView conversationId={activeId} onBack={() => navigate("/chats")} />
        ) : (
          <div className="premium-panel flex h-full flex-1 flex-col items-center justify-center rounded-[18px] px-6 text-center">
            <span className="grid size-14 place-items-center rounded-[18px] border border-ember/15 bg-ember/10 text-ember">
              <MessageCircleMore className="size-6" />
            </span>
            <h2 className="mt-4 font-display text-base font-semibold">Your conversations live here</h2>
            <p className="mt-1.5 max-w-sm text-xs leading-5 text-(--text-secondary)">
              Choose a conversation on the left, or start a new one to connect with your team.
            </p>
            <Button className="mt-5" size="sm" onClick={() => setIsNewOpen(true)}>
              <MessageSquarePlus className="size-3.5" />
              New conversation
            </Button>
          </div>
        )}
      </div>

      <NewConversationModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
