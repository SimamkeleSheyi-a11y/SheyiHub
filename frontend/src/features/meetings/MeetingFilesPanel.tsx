import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FileSharePanel } from "@/features/files/FileSharePanel";
import { meetingsApi } from "@/features/meetings/api";

export function MeetingFilesPanel({ meetingId }: { meetingId: string }) {
  const query = useQuery({ queryKey: ["meeting-conversation", meetingId], queryFn: () => meetingsApi.conversation(meetingId) });
  if (query.isLoading) return <div className="flex flex-1 items-center justify-center text-stone-400"><Loader2 className="size-5 animate-spin" /></div>;
  if (query.isError || !query.data) return <ErrorBanner message="Meeting files couldn't be opened." />;
  return <FileSharePanel conversationId={query.data.id} />;
}
