import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Check, Loader2, Pencil, Trash2, UserPlus, Users, Video, X } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { inviteStatusLabel, meetingsApi } from "@/features/meetings/api";
import { MeetingFilesPanel } from "@/features/meetings/MeetingFilesPanel";
import { MeetingWhiteboard } from "@/features/meetings/MeetingWhiteboard";
import { ApiError } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { InviteStatus } from "@/types/meeting";

function inviteTone(status: InviteStatus) {
  if (status === "accepted") return "signal" as const;
  if (status === "declined") return "rust" as const;
  return "neutral" as const;
}

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [participantEmail, setParticipantEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    data: meeting,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["meeting", id],
    queryFn: () => meetingsApi.detail(id!),
    enabled: !!id,
  });

  const refreshMeeting = () => {
    queryClient.invalidateQueries({ queryKey: ["meeting", id] });
    queryClient.invalidateQueries({ queryKey: ["meetings"] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: { title: string }) => meetingsApi.update(id!, data),
    onSuccess: () => {
      refreshMeeting();
      setIsEditing(false);
      toast.success("Meeting updated.");
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't save changes."),
  });

  const cancelMutation = useMutation({
    mutationFn: () => meetingsApi.cancel(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting cancelled.");
      navigate("/meetings");
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: (email: string) => meetingsApi.addParticipant(id!, email),
    onSuccess: () => {
      setParticipantEmail("");
      setFormError(null);
      refreshMeeting();
      toast.success("Participant invited.");
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't invite that user."),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: (inviteId: string) => meetingsApi.removeParticipant(id!, inviteId),
    onSuccess: () => {
      refreshMeeting();
      toast.success("Participant removed.");
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't remove participant."),
  });

  const respondMutation = useMutation({
    mutationFn: (response: "accept" | "decline") => meetingsApi.respond(id!, response),
    onSuccess: (_, response) => {
      refreshMeeting();
      toast.success(response === "accept" ? "Invitation accepted." : "Invitation declined.");
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Couldn't update your RSVP."),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-(--text-secondary)" />
      </div>
    );
  }

  if (isError || !meeting) {
    return <ErrorBanner message="You don't have access to this meeting, or it doesn't exist." />;
  }

  const isHost = currentUser?.id === meeting.host.id;
  const myInvite = meeting.participants.find((participant) => participant.user.id === currentUser?.id);
  const canAccessSharedContent = isHost || myInvite?.status === "accepted";
  const canJoin = canAccessSharedContent && ["scheduled", "live"].includes(meeting.status);
  const completedDuration = meeting.actual_start
    ? formatMeetingDuration(new Date(meeting.actual_start), meeting.actual_end ? new Date(meeting.actual_end) : new Date())
    : null;

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          {isEditing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold" />
          ) : (
            <h1 className="font-display text-xl font-semibold text-(--text-primary)">{meeting.title}</h1>
          )}
          <Badge tone={meeting.status === "cancelled" ? "rust" : "neutral"}>{meeting.status}</Badge>
        </div>

        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-(--text-secondary)">Host</dt>
          <dd className="text-(--text-primary)">{meeting.host.display_name}</dd>
          <dt className="text-(--text-secondary)">Starts</dt>
          <dd className="text-(--text-primary)">
            {new Date(meeting.scheduled_start).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
          <dt className="text-(--text-secondary)">Ends</dt>
          <dd className="text-(--text-primary)">
            {new Date(meeting.scheduled_end).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </dd>
          <dt className="text-(--text-secondary)">Room</dt>
          <dd className="font-mono text-(--text-primary)">{meeting.room_slug}</dd>
          <dt className="text-(--text-secondary)">Waiting room</dt>
          <dd className="text-(--text-primary)">{meeting.waiting_room_enabled ? "Enabled" : "Disabled"}</dd>
          {completedDuration ? (<>
            <dt className="text-(--text-secondary)">Duration</dt>
            <dd className="text-(--text-primary)">{completedDuration}</dd>
          </>) : null}
        </dl>

        {!isHost && myInvite && meeting.status === "scheduled" ? (
          <div className="rounded-lg border border-(--border) bg-(--surface) p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium text-(--text-primary)">Your invitation</p>
                <p className="text-sm text-(--text-secondary)">Let the organiser know if you can attend.</p>
              </div>
              <Badge tone={inviteTone(myInvite.status)}>{inviteStatusLabel(myInvite.status)}</Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                isLoading={respondMutation.isPending && respondMutation.variables === "accept"}
                onClick={() => respondMutation.mutate("accept")}
              >
                <Check className="size-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isLoading={respondMutation.isPending && respondMutation.variables === "decline"}
                onClick={() => respondMutation.mutate("decline")}
              >
                <X className="size-4" /> Decline
              </Button>
            </div>
          </div>
        ) : null}

        {formError ? <ErrorBanner message={formError} /> : null}

        {canJoin ? (
          <div className="flex flex-wrap gap-2 border-t border-(--border) pt-4">
            <Button onClick={() => navigate(`/meetings/${meeting.id}/room`)}>
              <Video className="size-4" /> {isHost && meeting.status === "scheduled" ? "Start meeting" : "Join meeting"}
            </Button>
            {!isHost && meeting.status === "scheduled" ? (
              <span className="self-center text-xs text-(--text-secondary)">The room opens when the host starts.</span>
            ) : null}
          </div>
        ) : null}

        {isHost && meeting.status === "scheduled" ? (
          <div className="flex gap-2 border-t border-(--border) pt-4">
            {isEditing ? (
              <>
                <Button isLoading={updateMutation.isPending} onClick={() => updateMutation.mutate({ title })}>
                  Save
                </Button>
                <Button variant="ghost" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTitle(meeting.title);
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button variant="destructive" onClick={() => setIsCancelOpen(true)}>
                  <Ban className="size-4" /> Cancel meeting
                </Button>
              </>
            )}
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-(--text-primary)">
              <Users className="size-5" /> Participants
            </h2>
            <p className="text-sm text-(--text-secondary)">Invitations and RSVP status for this meeting.</p>
          </div>
          <Badge>{meeting.participants.length}</Badge>
        </div>

        {isHost && meeting.status === "scheduled" ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const email = participantEmail.trim();
              if (email) addParticipantMutation.mutate(email);
            }}
          >
            <div className="flex-1">
              <Input
                type="email"
                placeholder="Registered user's email"
                value={participantEmail}
                onChange={(event) => setParticipantEmail(event.target.value)}
              />
            </div>
            <Button type="submit" isLoading={addParticipantMutation.isPending} disabled={!participantEmail.trim()}>
              <UserPlus className="size-4" /> Invite
            </Button>
          </form>
        ) : null}

        {meeting.participants.length === 0 ? (
          <p className="rounded-lg border border-dashed border-(--border) p-4 text-sm text-(--text-secondary)">
            No participants have been invited yet.
          </p>
        ) : (
          <div className="divide-y divide-(--border) rounded-lg border border-(--border)">
            {meeting.participants.map((participant) => (
              <div key={participant.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={participant.user.display_name} src={participant.user.avatar_url} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-(--text-primary)">{participant.user.display_name}</p>
                    <p className="truncate text-sm text-(--text-secondary)">{participant.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={inviteTone(participant.status)}>{inviteStatusLabel(participant.status)}</Badge>
                  {isHost && meeting.status === "scheduled" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${participant.user.display_name}`}
                      disabled={removeParticipantMutation.isPending}
                      onClick={() => removeParticipantMutation.mutate(participant.id)}
                    >
                      <Trash2 className="size-4 text-rust" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {canAccessSharedContent ? (
        <Card className="flex min-h-[360px] flex-col gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-(--text-primary)">Shared files</h2>
            <p className="text-sm text-(--text-secondary)">Files stay available here after the meeting ends.</p>
          </div>
          <div className="min-h-[300px] flex-1"><MeetingFilesPanel meetingId={meeting.id} /></div>
        </Card>
      ) : null}

      {canAccessSharedContent ? (
        <Card className="flex min-h-[440px] flex-col gap-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-(--text-primary)">
              <Pencil className="size-5" /> Saved whiteboard
            </h2>
            <p className="text-sm text-(--text-secondary)">The board is preserved with the meeting and remains viewable after it ends.</p>
          </div>
          <MeetingWhiteboard meetingId={meeting.id} className="min-h-[360px] flex-1" />
        </Card>
      ) : null}

      <Modal isOpen={isCancelOpen} onClose={() => setIsCancelOpen(false)} title="Cancel this meeting?">
        <p className="mb-4 text-sm text-(--text-secondary)">
          This can't be undone. Everyone invited will no longer be able to join.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setIsCancelOpen(false)}>
            Keep meeting
          </Button>
          <Button
            variant="destructive"
            isLoading={cancelMutation.isPending}
            onClick={() => cancelMutation.mutate()}
          >
            Cancel meeting
          </Button>
        </div>
      </Modal>
    </div>
  );
}


function formatMeetingDuration(start: Date, end: Date) {
  const totalSeconds = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
