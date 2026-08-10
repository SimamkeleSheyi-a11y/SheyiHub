import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Input } from "@/components/Input";
import { meetingsApi } from "@/features/meetings/api";
import { ApiError } from "@/lib/apiClient";
import { toast } from "@/stores/toastStore";

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ScheduleMeetingPage() {
  const navigate = useNavigate();
  const inOneHour = new Date(Date.now() + 60 * 60_000);
  const inNinetyMin = new Date(Date.now() + 90 * 60_000);

  const [title, setTitle] = useState("");
  const [start, setStart] = useState(toLocalInputValue(inOneHour));
  const [end, setEnd] = useState(toLocalInputValue(inNinetyMin));
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [invitees, setInvitees] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: meetingsApi.create,
    onSuccess: (meeting) => {
      toast.success("Meeting scheduled.");
      navigate(`/meetings/${meeting.id}`);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Something went wrong."),
  });

  function addInvitee(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const email = inviteInput.trim().replace(/,$/, "");
    if (email && !invitees.includes(email)) setInvitees([...invitees, email]);
    setInviteInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate({
      title,
      scheduled_start: new Date(start).toISOString(),
      scheduled_end: new Date(end).toISOString(),
      waiting_room_enabled: waitingRoom,
      invitee_emails: invitees,
    });
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <h1 className="mb-6 font-display text-2xl font-semibold text-(--text-primary)">Schedule a meeting</h1>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 rounded-xl border border-(--border) bg-(--surface-raised) p-6 shadow-[var(--shadow-elevation-1)]"
      >
        <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Starts"
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <Input
            label="Ends"
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-(--text-primary)">Invitees</label>
          <div className="flex flex-wrap gap-1.5 rounded-md border border-(--border) bg-(--surface-raised) p-2">
            {invitees.map((email) => (
              <span
                key={email}
                className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs dark:bg-white/10"
              >
                {email}
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  onClick={() => setInvitees(invitees.filter((i) => i !== email))}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              onKeyDown={addInvitee}
              placeholder="Type an email, press Enter"
              className="min-w-32 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-(--text-primary)">
          <input
            type="checkbox"
            checked={waitingRoom}
            onChange={(e) => setWaitingRoom(e.target.checked)}
            className="size-4.5 rounded border-(--border) accent-pine"
          />
          Enable waiting room
        </label>

        {formError ? <ErrorBanner message={formError} /> : null}

        <div className="flex gap-2">
          <Button type="submit" isLoading={createMutation.isPending} disabled={!title}>
            Schedule
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
