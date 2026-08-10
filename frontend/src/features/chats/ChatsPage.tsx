import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus, Users } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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
  if (conversation.type === "group") {
    return conversation.participants.map((p) => p.display_name).join(", ") || "Group";
  }
  return conversation.participants[0]?.display_name ?? "Conversation";
}

export function ChatsPage() {
  const { id: activeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [isNewOpen, setIsNewOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["conversations"],
    queryFn: chatsApi.listConversations,
    refetchInterval: 30_000,
  });

  const conversations = Array.isArray(data) ? data : (data?.results ?? []);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 md:h-[calc(100vh-3.5rem)]">
      {/*
        Mobile is single-pane: the list OR the conversation, never both — the
        outer column itself toggles `hidden`, not just its contents, since a
        squeezed-but-still-present list column was the actual bug (its header
        stayed visible and still claimed width even when the items inside it
        were hidden). From md up, both panes are always shown side by side.
      */}
      <div
        className={cn(
          "flex-col gap-3 md:flex md:w-80 md:shrink-0",
          activeId ? "hidden md:flex" : "flex w-full"
        )}
      >
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold text-(--text-primary)">Chats</h1>
          <Button size="sm" variant="secondary" onClick={() => setIsNewOpen(true)}>
            <MessageSquarePlus className="size-4" /> New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : isError ? (
          <ErrorBanner message="Couldn't load your conversations." />
        ) : conversations.length === 0 ? (
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
        ) : (
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {conversations.map((c) => {
              const other = c.participants[0];
              return (
                <button
                  key={c.id}
                  onClick={() => navigate(`/chats/${c.id}`)}
                  className={cn(
                    "flex items-center gap-3 rounded-md p-2 text-left hover:bg-stone-100 dark:hover:bg-white/5",
                    activeId === c.id && "bg-stone-100 dark:bg-white/10"
                  )}
                >
                  <div className="relative shrink-0">
                    <span className="flex size-9 items-center justify-center rounded-full bg-pine text-sm font-medium text-white">
                      {conversationLabel(c)[0]?.toUpperCase()}
                    </span>
                    {c.type === "dm" && other ? (
                      <PresenceDot userId={other.id} className="absolute -bottom-0.5 -right-0.5" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-(--text-primary)">
                      {conversationLabel(c)}
                    </p>
                    <p className="truncate text-xs text-(--text-secondary)">
                      {c.last_message?.content ?? "No messages yet"}
                    </p>
                  </div>
                  {c.unread_count > 0 ? <Badge tone="ember">{c.unread_count}</Badge> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={cn("flex-col md:flex md:flex-1", activeId ? "flex w-full" : "hidden md:flex")}>
        {activeId ? (
          <ConversationView conversationId={activeId} onBack={() => navigate("/chats")} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-(--text-secondary)">
            Pick a conversation, or start a new one.
          </div>
        )}
      </div>

      <NewConversationModal isOpen={isNewOpen} onClose={() => setIsNewOpen(false)} />
    </div>
  );
}
