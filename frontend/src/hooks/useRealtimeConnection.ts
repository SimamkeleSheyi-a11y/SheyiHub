import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";

import { wsClient } from "@/lib/wsClient";
import { useAuthStore } from "@/stores/authStore";
import { usePresenceStore } from "@/stores/presenceStore";
import { useReadReceiptStore } from "@/stores/readReceiptStore";
import { toast } from "@/stores/toastStore";
import { useTypingStore } from "@/stores/typingStore";
import type { Message } from "@/types/messaging";

interface MessagePage {
  results: Message[];
  count: number;
  next: string | null;
  previous: string | null;
}

export function useRealtimeConnection() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    wsClient.connect();

    const unsubscribers = [
      wsClient.on("chat.message", (data) => {
        const message = data as unknown as Message;
        // Messages are paginated (useInfiniteQuery) — a new arrival is the
        // newest message, so it belongs at the front of the first (newest) page.
        queryClient.setQueryData<InfiniteData<MessagePage>>(["messages", message.conversation], (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          if (firstPage?.results.some((m) => m.id === message.id)) return old;
          const updatedFirstPage = { ...firstPage, results: [message, ...(firstPage?.results ?? [])] };
          return { ...old, pages: [updatedFirstPage, ...old.pages.slice(1)] };
        });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }),

      wsClient.on("typing", (data) => {
        useTypingStore
          .getState()
          .setTyping(data.conversation_id as string, data.user_id as string, data.is_typing as boolean);
      }),

      wsClient.on("message.read", (data) => {
        useReadReceiptStore
          .getState()
          .setLastRead(
            data.conversation_id as string,
            data.user_id as string,
            data.last_read_message_id as string
          );
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }),

      wsClient.on("presence.update", (data) => {
        usePresenceStore
          .getState()
          .setStatus(
            data.user_id as string,
            data.status as "online" | "offline",
            (data.last_seen as string | null) ?? null
          );
      }),

      wsClient.on("error", (data) => {
        toast.error((data.message as string) ?? "Something went wrong.");
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
      wsClient.disconnect();
    };
  }, [user, queryClient]);
}
