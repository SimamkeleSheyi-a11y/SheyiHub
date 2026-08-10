import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Check, CheckCheck, FolderOpen, Loader2, RotateCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { PresenceDot } from "@/components/PresenceDot";
import { Skeleton } from "@/components/Skeleton";
import { chatsApi } from "@/features/chats/api";
import { FileSharePanel } from "@/features/files/FileSharePanel";
import { cn } from "@/lib/cn";
import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import { useReadReceiptStore } from "@/stores/readReceiptStore";
import { useTypingStore } from "@/stores/typingStore";
import type { Conversation, Message } from "@/types/messaging";

// Stable empty fallbacks — a fresh [] / Set() as a selector default creates a
// new reference every render, which looks like "changed" forever to
// Zustand/useSyncExternalStore and infinite-loops (found the hard way in
// Phase 5; keeping the fix visible here since this file is exactly where
// that pattern recurs).
const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_READ_MAP: Readonly<Record<string, string>> = {};

interface PendingMessage {
  clientId: string;
  content: string;
  status: "sending" | "failed";
}

const REST_FALLBACK_TIMEOUT_MS = 4000;
const TYPING_THROTTLE_MS = 2000;

export function ConversationView({
  conversationId,
  onBack,
  conversationOverride,
}: {
  conversationId: string;
  onBack?: () => void;
  conversationOverride?: Conversation;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [filesOpen, setFilesOpen] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastTypingSentAt = useRef<number>(0);
  const fallbackTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: chatsApi.listConversations,
  });
  const conversationList: Conversation[] = Array.isArray(conversations)
    ? conversations
    : (conversations?.results ?? []);
  const conversation = conversationOverride ?? conversationList.find((c) => c.id === conversationId);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) => chatsApi.listMessages(conversationId, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const page = Array.isArray(lastPage) ? null : lastPage;
      return page?.next ? allPages.length + 1 : undefined;
    },
  });

  // Each page is newest-first; concatenating pages in fetch order (page 1 =
  // newest, page 2 = older, ...) then reversing gives oldest-to-newest overall.
  const messages = useMemo(() => {
    const flatNewestFirst = (data?.pages ?? []).flatMap((p) => (Array.isArray(p) ? p : p.results));
    return [...flatNewestFirst].reverse();
  }, [data]);

  const typingUserIds = useTypingStore((s) => s.typingByConversation[conversationId] ?? EMPTY_SET);
  const otherParticipants = conversation?.participants ?? [];
  const typingParticipants = otherParticipants.filter((p) => typingUserIds.has(p.id));
  const lastReadByUser = useReadReceiptStore(
    (s) => s.lastReadByConversation[conversationId] ?? EMPTY_READ_MAP
  );

  // Seed read receipts from the server's current state on load — otherwise a
  // participant who read the conversation before this view was even open
  // would show as unread until *another* read event happened to arrive live.
  useEffect(() => {
    if (!conversation) return;
    Object.entries(conversation.read_states).forEach(([userId, messageId]) => {
      useReadReceiptStore.getState().setLastRead(conversationId, userId, messageId);
    });
  }, [conversation, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typingParticipants.length]);

  // Mark the latest real (non-pending) message as read whenever it changes.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) {
      wsClient.send({ type: "message-read", conversation_id: conversationId, last_read_message_id: last.id });
    }
  }, [conversationId, messages]);

  // A pending send is "confirmed" once a real message with the same
  // client_message_id shows up in the fetched/received data.
  useEffect(() => {
    if (pending.length === 0) return;
    const confirmedIds = new Set(messages.map((m) => m.client_message_id).filter(Boolean));
    setPending((prev) => {
      const stillPending = prev.filter((p) => !confirmedIds.has(p.clientId));
      if (stillPending.length === prev.length) return prev;
      stillPending.forEach(() => {});
      prev
        .filter((p) => confirmedIds.has(p.clientId))
        .forEach((p) => {
          const timer = fallbackTimers.current.get(p.clientId);
          if (timer) clearTimeout(timer);
          fallbackTimers.current.delete(p.clientId);
        });
      return stillPending;
    });
  }, [messages, pending.length]);

  async function sendViaRest(clientId: string, content: string) {
    try {
      await chatsApi.sendMessage(conversationId, content, clientId);
      // The REST response is the source of truth here; a lightweight
      // refetch picks it up via the normal query, keeping one code path
      // for "a real message arrived" (the effect above clears `pending`).
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    } catch {
      setPending((prev) => prev.map((p) => (p.clientId === clientId ? { ...p, status: "failed" } : p)));
    }
  }

  function attemptSend(clientId: string, content: string) {
    const wentOverSocket = wsClient.send({
      type: "chat-message",
      conversation_id: conversationId,
      content,
      client_message_id: clientId,
    });

    // Whether or not the socket accepted it, arm a fallback: if nothing
    // confirms this message within the timeout, retry over REST instead of
    // leaving it stuck on "Sending" forever (Phase 5 hardening #5).
    const timer = setTimeout(() => {
      setPending((prev) => {
        const stillWaiting = prev.some((p) => p.clientId === clientId && p.status === "sending");
        if (stillWaiting) sendViaRest(clientId, content);
        return prev;
      });
    }, REST_FALLBACK_TIMEOUT_MS);
    fallbackTimers.current.set(clientId, timer);

    if (!wentOverSocket) {
      // Socket wasn't even open — no point waiting out the timeout.
      clearTimeout(timer);
      fallbackTimers.current.delete(clientId);
      sendViaRest(clientId, content);
    }
  }

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    const clientId = crypto.randomUUID();
    setPending((prev) => [...prev, { clientId, content, status: "sending" }]);
    setDraft("");
    wsClient.send({ type: "typing", conversation_id: conversationId, is_typing: false });
    attemptSend(clientId, content);
  }

  function handleRetry(message: PendingMessage) {
    setPending((prev) =>
      prev.map((p) => (p.clientId === message.clientId ? { ...p, status: "sending" } : p))
    );
    attemptSend(message.clientId, message.content);
  }

  function handleDraftChange(value: string) {
    setDraft(value);

    // Throttle: send "still typing" at most once every ~2s while continuously
    // typing, not on every keystroke (Phase 5 hardening — client-side half of
    // throttling; the backend also caps redundant broadcasts server-side).
    const now = Date.now();
    if (now - lastTypingSentAt.current > TYPING_THROTTLE_MS) {
      wsClient.send({ type: "typing", conversation_id: conversationId, is_typing: true });
      lastTypingSentAt.current = now;
    }

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      wsClient.send({ type: "typing", conversation_id: conversationId, is_typing: false });
      lastTypingSentAt.current = 0;
    }, 2000);
  }

  function handleLoadOlder() {
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    const prevTop = container?.scrollTop ?? 0;
    fetchNextPage().then(() => {
      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollTop = container.scrollHeight - prevHeight + prevTop;
      });
    });
  }

  const isGroup = conversation?.type !== "dm";

  return (
    <div className="flex h-full flex-col rounded-lg border border-(--border) bg-(--surface-raised)">
      <div className="flex items-center gap-2 border-b border-(--border) px-4 py-3">
        {onBack ? (
          <button
            onClick={onBack}
            aria-label="Back to conversations"
            className="-ml-1.5 rounded-md p-1.5 text-(--text-secondary) hover:bg-stone-100 md:hidden dark:hover:bg-white/10"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : null}
        {!isGroup && otherParticipants[0] ? (
          <div className="relative shrink-0">
            <Avatar name={otherParticipants[0].display_name} src={otherParticipants[0].avatar_url} size="sm" />
            <PresenceDot userId={otherParticipants[0].id} className="absolute -bottom-0.5 -right-0.5" />
          </div>
        ) : null}
        <span className="truncate font-medium text-(--text-primary)">
          {otherParticipants.map((p) => p.display_name).join(", ") || "Conversation"}
        </span>
        <button onClick={() => setFilesOpen(true)} aria-label="Shared files" className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-(--text-secondary) hover:bg-stone-100 dark:hover:bg-white/10">
          <FolderOpen className="size-4" /> Files
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="ml-auto h-10 w-2/3" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {hasNextPage ? (
              <button
                onClick={handleLoadOlder}
                disabled={isFetchingNextPage}
                className="mx-auto mb-2 rounded-md px-3 py-1 text-xs font-medium text-(--text-secondary) hover:bg-stone-100 disabled:opacity-50 dark:hover:bg-white/5"
              >
                {isFetchingNextPage ? "Loading…" : "Load older messages"}
              </button>
            ) : null}

            {messages.map((m, i) => {
              const isOwn = m.sender.id === currentUser?.id;
              const showSenderName = isGroup && !isOwn && messages[i - 1]?.sender.id !== m.sender.id;
              const readByCount = otherParticipants.filter(
                (p) => lastReadByUser[p.id] && messageAtOrBefore(messages, lastReadByUser[p.id], m.id)
              ).length;
              return (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isOwn={isOwn}
                  showSenderName={showSenderName}
                  isGroup={isGroup}
                  readByCount={isOwn ? readByCount : undefined}
                  totalOthers={otherParticipants.length}
                />
              );
            })}

            {pending.map((p) => (
              <PendingBubble key={p.clientId} pending={p} onRetry={() => handleRetry(p)} />
            ))}

            {typingParticipants.length > 0 ? (
              <TypingIndicator names={typingParticipants.map((p) => p.display_name)} />
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-(--border) p-3">
        <input
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Message"
          className="flex-1 rounded-md border border-(--border) bg-(--surface-raised) px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ember"
        />
        <button
          onClick={handleSend}
          aria-label="Send"
          disabled={!draft.trim()}
          className="rounded-md bg-ember p-2 text-stone-900 disabled:opacity-40"
        >
          <Send className="size-4" />
        </button>
      </div>
      <Modal isOpen={filesOpen} onClose={() => setFilesOpen(false)} title="Shared files" size="md">
        <div className="h-[min(70vh,620px)]"><FileSharePanel conversationId={conversationId} /></div>
      </Modal>
    </div>
  );
}

/** Message ids aren't chronologically sortable directly, so "read up to X"
 * is resolved against the currently-loaded, oldest-to-newest `messages`
 * array — good enough for the visible window, which is what read ticks
 * are for. */
function messageAtOrBefore(messages: Message[], lastReadId: string, targetId: string): boolean {
  const lastReadIndex = messages.findIndex((m) => m.id === lastReadId);
  const targetIndex = messages.findIndex((m) => m.id === targetId);
  if (lastReadIndex === -1 || targetIndex === -1) return false;
  return targetIndex <= lastReadIndex;
}

function MessageBubble({
  message,
  isOwn,
  showSenderName,
  isGroup,
  readByCount,
  totalOthers,
}: {
  message: Message;
  isOwn: boolean;
  showSenderName: boolean;
  isGroup: boolean;
  readByCount?: number;
  totalOthers: number;
}) {
  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      {showSenderName ? (
        <span className="mb-0.5 px-1 text-xs text-(--text-secondary)">{message.sender.display_name}</span>
      ) : null}
      <div
        className={cn(
          "max-w-[70%] rounded-lg px-3 py-2 text-sm",
          isOwn ? "bg-pine text-white" : "bg-stone-100 text-(--text-primary) dark:bg-white/10"
        )}
      >
        {message.content}
      </div>
      {isOwn && readByCount !== undefined ? (
        <span className="mt-0.5 flex items-center gap-0.5 px-1 text-[11px] text-(--text-secondary)">
          <ReceiptLabel isGroup={isGroup} readByCount={readByCount} totalOthers={totalOthers} />
        </span>
      ) : null}
    </div>
  );
}

function ReceiptLabel({
  isGroup,
  readByCount,
  totalOthers,
}: {
  isGroup: boolean;
  readByCount: number;
  totalOthers: number;
}) {
  if (!isGroup) {
    // DM: one other participant, binary makes sense.
    return readByCount > 0 ? (
      <>
        <CheckCheck className="size-3 text-signal" /> Read
      </>
    ) : (
      <>
        <Check className="size-3" /> Sent
      </>
    );
  }

  if (readByCount === 0) {
    return (
      <>
        <Check className="size-3" /> Sent
      </>
    );
  }
  if (readByCount >= totalOthers && totalOthers > 0) {
    return (
      <>
        <CheckCheck className="size-3 text-signal" /> Read by everyone
      </>
    );
  }
  return (
    <>
      <CheckCheck className="size-3 text-signal" /> Read by {readByCount}/{totalOthers}
    </>
  );
}

function PendingBubble({ pending, onRetry }: { pending: PendingMessage; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-end">
      <div className="max-w-[70%] rounded-lg bg-pine px-3 py-2 text-sm text-white opacity-70">
        {pending.content}
      </div>
      <span className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-(--text-secondary)">
        {pending.status === "sending" ? (
          <>
            <Loader2 className="size-3 animate-spin" /> Sending…
          </>
        ) : (
          <button onClick={onRetry} className="flex items-center gap-1 text-rust hover:underline">
            <AlertCircle className="size-3" /> Failed — retry <RotateCw className="size-3" />
          </button>
        )}
      </span>
    </div>
  );
}

function TypingIndicator({ names }: { names: string[] }) {
  const label = names.length === 1 ? `${names[0]} is typing…` : `${names.join(", ")} are typing…`;
  return (
    <div className="flex items-center gap-2">
      <div className="flex w-fit gap-1 rounded-full bg-stone-100 px-3 py-2 dark:bg-white/10" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-stone-400"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <span className="text-xs text-(--text-secondary)">{label}</span>
    </div>
  );
}
