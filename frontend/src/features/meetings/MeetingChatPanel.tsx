import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle } from "lucide-react";

import { ErrorBanner } from "@/components/ErrorBanner";
import { ConversationView } from "@/features/chats/ConversationView";
import { meetingsApi } from "@/features/meetings/api";

export function MeetingChatPanel({ meetingId }: { meetingId: string }) {
  const { data: conversation, isLoading, isError } = useQuery({
    queryKey: ["meeting-conversation", meetingId],
    queryFn: () => meetingsApi.conversation(meetingId),
  });

  if (isLoading) {
    return (
      <div className="flex h-full min-h-72 items-center justify-center text-stone-400">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (isError || !conversation) {
    return <ErrorBanner message="Meeting chat couldn't be opened." />;
  }

  return (
    <div className="flex h-full min-h-72 flex-col">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-200">
        <MessageCircle className="size-4" /> Meeting chat
      </div>
      <div className="min-h-0 flex-1 text-stone-900 dark:text-stone-100">
        <ConversationView conversationId={conversation.id} conversationOverride={conversation} />
      </div>
    </div>
  );
}
