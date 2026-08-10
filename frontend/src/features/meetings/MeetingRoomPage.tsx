import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  MessageCircle,
  FolderOpen,
  Mic,
  Monitor,
  MicOff,
  PhoneOff,
  Pencil,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { meetingsApi } from "@/features/meetings/api";
import { MeetingChatPanel } from "@/features/meetings/MeetingChatPanel";
import { MeetingFilesPanel } from "@/features/meetings/MeetingFilesPanel";
import { MeetingWhiteboard } from "@/features/meetings/MeetingWhiteboard";
import { VideoTile } from "@/features/meetings/VideoTile";
import { useMeetingCall } from "@/features/meetings/useMeetingCall";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";

export function MeetingRoomPage() {
  const { id } = useParams<{ id: string }>();
  const meetingId = id!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useAuthStore((state) => state.user);
  const [isJoining, setIsJoining] = useState(false);
  const [sideTab, setSideTab] = useState<"participants" | "chat" | "files">("participants");
  const [stageMode, setStageMode] = useState<"video" | "whiteboard">("video");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const meetingQuery = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: () => meetingsApi.detail(meetingId),
    enabled: !!meetingId,
  });

  const call = useMeetingCall(meetingId);

  useEffect(() => {
    if (call.meetingStartedSignal > 0) {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    }
  }, [call.meetingStartedSignal, meetingId, queryClient]);

  useEffect(() => {
    if (call.meetingEnded) {
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      toast.info("The host ended the meeting.");
    }
  }, [call.meetingEnded, meetingId, queryClient]);

  const endMutation = useMutation({
    mutationFn: () => meetingsApi.end(meetingId),
    onSuccess: () => {
      call.leaveMeeting();
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      navigate(`/meetings/${meetingId}`);
      toast.success("Meeting ended.");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : "Couldn't end the meeting."),
  });

  const meeting = meetingQuery.data;

  useEffect(() => {
    if (!meeting?.actual_start || meeting.status !== "live") return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [meeting?.actual_start, meeting?.status]);

  const liveDuration = meeting?.actual_start
    ? formatDuration(Math.max(0, nowMs - new Date(meeting.actual_start).getTime()))
    : "00:00";
  const isHost = !!meeting && me?.id === meeting.host.id;
  const myInvite = meeting?.participants.find((participant) => participant.user.id === me?.id);
  const canAttemptJoin = isHost || myInvite?.status === "accepted";

  const activeParticipants = useMemo(
    () => call.participants.filter((participant) => participant.status === "admitted"),
    [call.participants]
  );
  const waitingParticipants = useMemo(
    () => call.participants.filter((participant) => participant.status === "waiting"),
    [call.participants]
  );

  async function handleJoin() {
    setIsJoining(true);
    try {
      if (isHost && meeting?.status === "scheduled") {
        await meetingsApi.start(meetingId);
        await queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
      }
      await call.joinMeeting();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join the meeting.");
    } finally {
      setIsJoining(false);
    }
  }

  function handleLeave() {
    call.leaveMeeting();
    navigate(`/meetings/${meetingId}`);
  }

  if (meetingQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 text-white">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }

  if (meetingQuery.isError || !meeting) {
    return (
      <div className="min-h-screen bg-stone-950 p-6 text-white">
        <div className="mx-auto max-w-xl">
          <ErrorBanner message="You don't have access to this meeting, or it doesn't exist." />
        </div>
      </div>
    );
  }

  if (meeting.status === "cancelled" || meeting.status === "ended" || call.meetingEnded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <PhoneOff className="mx-auto mb-4 size-10 text-ember" />
          <h1 className="font-display text-2xl font-semibold">This meeting has ended</h1>
          <p className="mt-2 text-sm text-stone-400">You can return to the meeting details and history.</p>
          <Button className="mt-6" onClick={() => navigate(`/meetings/${meetingId}`)}>
            <ArrowLeft className="size-4" /> Back to meeting
          </Button>
        </div>
      </div>
    );
  }

  if (call.joinStatus === "idle") {
    return (
      <div className="min-h-screen bg-stone-950 p-4 text-white sm:p-6">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
          <div className="grid w-full gap-5 lg:grid-cols-[1.35fr_.65fr]">
            <div className="min-h-[360px] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {call.localStream ? (
                <VideoTile
                  name={me?.display_name ?? "You"}
                  stream={call.localStream}
                  isLocal
                  muted
                  micEnabled={call.micEnabled}
                  cameraEnabled={call.cameraEnabled}
                  className="h-full min-h-[360px] border-0 rounded-none"
                />
              ) : (
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-8 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-ember/15 text-ember">
                    <Video className="size-7" />
                  </div>
                  <h2 className="font-display text-xl font-semibold">Ready to join?</h2>
                  <p className="max-w-sm text-sm text-stone-400">
                    SheyiHub will ask for camera and microphone permission when you join.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[.18em] text-ember">
                <ShieldCheck className="size-4" /> SheyiHub meeting
              </div>
              <h1 className="font-display text-2xl font-semibold">{meeting.title}</h1>
              <p className="mt-2 text-sm text-stone-400">Hosted by {meeting.host.display_name}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge>{meeting.status}</Badge>
                {meeting.waiting_room_enabled ? <Badge>Waiting room</Badge> : null}
              </div>

              {!canAttemptJoin ? (
                <div className="mt-6 rounded-xl border border-rust/30 bg-rust/10 p-4 text-sm text-stone-200">
                  {myInvite?.status === "pending"
                    ? "Accept your invitation from the meeting details before joining."
                    : myInvite?.status === "declined"
                      ? "You declined this invitation."
                      : "You don't have permission to join this meeting."}
                </div>
              ) : !isHost && meeting.status !== "live" ? (
                <div className="mt-6 rounded-xl border border-ember/30 bg-ember/10 p-4 text-sm text-stone-200">
                  Waiting for the host to start the meeting. You can try again once it is live.
                </div>
              ) : null}

              {call.error ? <div className="mt-4"><ErrorBanner message={call.error} /></div> : null}

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  size="lg"
                  isLoading={isJoining}
                  disabled={!canAttemptJoin || (!isHost && meeting.status !== "live")}
                  onClick={handleJoin}
                >
                  <Video className="size-5" /> {isHost && meeting.status === "scheduled" ? "Start meeting" : "Join meeting"}
                </Button>
                <Button variant="ghost" onClick={() => navigate(`/meetings/${meetingId}`)}>
                  <ArrowLeft className="size-4" /> Back to details
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (call.joinStatus === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <Loader2 className="mx-auto mb-4 size-9 animate-spin text-ember" />
          <h1 className="font-display text-2xl font-semibold">You're in the waiting room</h1>
          <p className="mt-2 text-sm text-stone-400">The host has been notified. Keep this page open.</p>
          {call.localStream ? (
            <VideoTile
              name={me?.display_name ?? "You"}
              stream={call.localStream}
              isLocal
              muted
              micEnabled={call.micEnabled}
              cameraEnabled={call.cameraEnabled}
              className="mt-6 min-h-[240px]"
            />
          ) : null}
          <Button variant="ghost" className="mt-5" onClick={handleLeave}>
            <LogOut className="size-4" /> Leave waiting room
          </Button>
        </div>
      </div>
    );
  }

  if (call.joinStatus === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <UserX className="mx-auto mb-4 size-10 text-rust" />
          <h1 className="font-display text-2xl font-semibold">Entry wasn't approved</h1>
          <p className="mt-2 text-sm text-stone-400">The host didn't admit this account to the meeting.</p>
          <Button className="mt-6" onClick={handleLeave}>Back to meeting details</Button>
        </div>
      </div>
    );
  }

  const remoteParticipants = activeParticipants.filter((participant) => participant.user_id !== me?.id);

  return (
    <div className="flex min-h-screen flex-col bg-stone-950 text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,.12)]" />
            <span className="text-xs font-semibold uppercase tracking-[.14em] text-stone-400">Live · {liveDuration}</span>
          </div>
          <h1 className="truncate font-display text-lg font-semibold">{meeting.title}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-stone-300">
          <Users className="size-4" /> {activeParticipants.length}
        </div>
      </header>

      <main className="grid flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {stageMode === "whiteboard" ? (
          <section className="min-h-[520px]">
            <MeetingWhiteboard meetingId={meetingId} live isHost={isHost} className="h-full min-h-[520px]" />
          </section>
        ) : (
          <section
            className={`grid content-center gap-3 ${
              remoteParticipants.length === 0
                ? "grid-cols-1"
                : remoteParticipants.length <= 3
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            }`}
          >
            <VideoTile
              name={me?.display_name ?? "You"}
              stream={call.screenStream ?? call.localStream}
              isLocal={!call.screenSharing}
              muted
              micEnabled={call.micEnabled}
              cameraEnabled={call.screenSharing ? true : call.cameraEnabled}
              className={remoteParticipants.length === 0 ? "mx-auto h-[min(64vh,620px)] w-full max-w-4xl" : "aspect-video"}
            />

            {remoteParticipants.map((participant) => (
              <VideoTile
                key={participant.user_id}
                name={participant.screen_sharing ? `${participant.display_name} — presenting` : participant.display_name}
                stream={call.remoteStreams[participant.user_id] ?? null}
                micEnabled={participant.mic_enabled ?? true}
                cameraEnabled={participant.screen_sharing ? true : (participant.camera_enabled ?? true)}
                className="aspect-video"
              />
            ))}
          </section>
        )}

        <aside className="flex min-h-[360px] flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-black/20 p-1">
            <button
              onClick={() => setSideTab("participants")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition ${
                sideTab === "participants" ? "bg-white/10 text-white" : "text-stone-400 hover:text-white"
              }`}
            >
              <Users className="size-3.5" /> People
            </button>
            <button
              onClick={() => setSideTab("chat")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition ${
                sideTab === "chat" ? "bg-white/10 text-white" : "text-stone-400 hover:text-white"
              }`}
            >
              <MessageCircle className="size-3.5" /> Chat
            </button>
            <button
              onClick={() => setSideTab("files")}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition ${
                sideTab === "files" ? "bg-white/10 text-white" : "text-stone-400 hover:text-white"
              }`}
            >
              <FolderOpen className="size-3.5" /> Files
            </button>
          </div>

          {sideTab === "chat" ? (
            <MeetingChatPanel meetingId={meetingId} />
          ) : sideTab === "files" ? (
            <MeetingFilesPanel meetingId={meetingId} />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display font-semibold"><Users className="size-4" /> Participants</h2>
                <Badge>{activeParticipants.length}</Badge>
              </div>

              <div className="space-y-2">
                {activeParticipants.map((participant) => (
                  <div key={participant.user_id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
                    <Avatar
                      name={participant.display_name}
                      src={participant.avatar_url}
                      size="md"
                      className="bg-ember/15 text-ember"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{participant.display_name}</p>
                      <p className="text-xs text-stone-400">{participant.role === "host" ? "Host" : "Participant"}</p>
                    </div>
                    {participant.user_id === me?.id ? <Check className="size-4 text-emerald-400" /> : null}
                  </div>
                ))}
              </div>

              {isHost && waitingParticipants.length > 0 ? (
                <div className="mt-5 border-t border-white/10 pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-ember">Waiting room ({waitingParticipants.length})</h3>
                  <div className="space-y-2">
                    {waitingParticipants.map((participant) => (
                      <div key={participant.user_id} className="rounded-xl bg-white/5 p-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={participant.display_name} src={participant.avatar_url} size="sm" />
                          <p className="truncate text-sm font-medium">{participant.display_name}</p>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => call.admit(participant.user_id)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
                          >
                            <UserCheck className="size-3.5" /> Admit
                          </button>
                          <button
                            onClick={() => call.deny(participant.user_id)}
                            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-rust/15 px-2 py-1.5 text-xs font-medium text-red-300 hover:bg-rust/25"
                          >
                            <UserX className="size-3.5" /> Deny
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </main>

      <footer className="sticky bottom-0 flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-stone-950/95 px-4 py-4 backdrop-blur">
        <button
          onClick={call.toggleMic}
          aria-label={call.micEnabled ? "Mute microphone" : "Unmute microphone"}
          className={`flex size-11 items-center justify-center rounded-full transition ${call.micEnabled ? "bg-white/10 hover:bg-white/15" : "bg-rust text-white"}`}
        >
          {call.micEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>
        <button
          onClick={call.toggleCamera}
          aria-label={call.cameraEnabled ? "Turn camera off" : "Turn camera on"}
          className={`flex size-11 items-center justify-center rounded-full transition ${call.cameraEnabled ? "bg-white/10 hover:bg-white/15" : "bg-rust text-white"}`}
        >
          {call.cameraEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
        </button>
        <button
          onClick={() => call.screenSharing ? void call.stopScreenShare() : void call.startScreenShare()}
          aria-label={call.screenSharing ? "Stop sharing screen" : "Share screen"}
          className={`flex size-11 items-center justify-center rounded-full transition ${call.screenSharing ? "bg-ember text-stone-950" : "bg-white/10 hover:bg-white/15"}`}
        >
          <Monitor className="size-5" />
        </button>

        <button
          onClick={() => setStageMode((current) => current === "whiteboard" ? "video" : "whiteboard")}
          aria-label={stageMode === "whiteboard" ? "Return to video grid" : "Open collaborative whiteboard"}
          className={`flex size-11 items-center justify-center rounded-full transition ${stageMode === "whiteboard" ? "bg-ember text-stone-950" : "bg-white/10 hover:bg-white/15"}`}
        >
          <Pencil className="size-5" />
        </button>

        {isHost ? (
          <Button variant="destructive" isLoading={endMutation.isPending} onClick={() => endMutation.mutate()}>
            <PhoneOff className="size-4" /> End meeting
          </Button>
        ) : (
          <Button variant="destructive" onClick={handleLeave}>
            <PhoneOff className="size-4" /> Leave
          </Button>
        )}
      </footer>
    </div>
  );
}


function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
