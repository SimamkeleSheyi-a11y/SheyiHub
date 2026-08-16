import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Clock3, ShieldCheck, Sparkles, UserPlus, X } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
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
    <div className="mx-auto flex max-w-[1080px] flex-col gap-4 pb-2 sm:gap-5">
      <section className="relative overflow-hidden rounded-[18px] border border-(--border) bg-(--surface-raised) p-4 shadow-[var(--shadow-elevation-1)] sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-20 size-48 rounded-full bg-ember/10 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="grid size-10 shrink-0 place-items-center rounded-[11px] border border-(--border) bg-(--surface-soft) text-(--text-secondary) transition-colors hover:border-ember/30 hover:text-(--text-primary)"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember">
              <CalendarClock className="size-3.5" /> Plan a session
            </div>
            <h1 className="font-display text-[23px] font-semibold tracking-[-0.045em] sm:text-[27px]">Schedule a meeting</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-(--text-secondary) sm:text-xs">
              Set the time, invite your team and choose how people enter.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        <Card className="p-4 sm:p-6">
          <div className="mb-5 border-b border-(--border) pb-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[10px] bg-ember/10 text-ember">
                <Sparkles className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-sm font-semibold">Meeting details</h2>
                <p className="mt-0.5 text-[9px] text-(--text-secondary)">Everything your invitees need to know.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <Input label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design sync" />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Starts" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} />
              <Input label="Ends" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold">Invitees</label>
              <div className="flex min-h-12 flex-wrap gap-1.5 rounded-[11px] border border-(--border) bg-(--surface-soft) p-2.5 focus-within:border-ember/40 focus-within:ring-2 focus-within:ring-ember/15">
                {invitees.map((email) => (
                  <span key={email} className="flex max-w-full items-center gap-1.5 rounded-full border border-ember/15 bg-ember/10 px-2 py-1 text-[10px] font-medium">
                    <span className="max-w-[14rem] truncate">{email}</span>
                    <button type="button" aria-label={`Remove ${email}`} onClick={() => setInvitees(invitees.filter((i) => i !== email))}>
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  onKeyDown={addInvitee}
                  placeholder="Type an email, press Enter"
                  inputMode="email"
                  className="min-w-[10rem] flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-(--text-secondary)"
                />
              </div>
              <p className="text-[9px] leading-4 text-(--text-secondary)">Press Enter or comma after each email address.</p>
            </div>

            {formError ? <ErrorBanner message={formError} /> : null}

            <div className="grid gap-2 border-t border-(--border) pt-5 sm:flex sm:flex-wrap">
              <Button className="w-full sm:w-auto" type="submit" isLoading={createMutation.isPending} disabled={!title}>
                <CalendarClock className="size-4" /> Schedule meeting
              </Button>
              <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 lg:self-start">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[11px] bg-ember/10 text-ember">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <h2 className="text-xs font-semibold">Entry controls</h2>
                <p className="mt-0.5 text-[9px] text-(--text-secondary)">Control how guests join.</p>
              </div>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[12px] border border-(--border) bg-(--surface-soft) p-3.5">
              <input type="checkbox" checked={waitingRoom} onChange={(e) => setWaitingRoom(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-ember" />
              <span>
                <span className="block text-[11px] font-semibold">Enable waiting room</span>
                <span className="mt-1 block text-[9px] leading-4 text-(--text-secondary)">Guests wait until the host admits them.</span>
              </span>
            </label>
          </Card>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-[11px] bg-ember/10 text-ember">
                <UserPlus className="size-4" />
              </span>
              <div>
                <h2 className="text-xs font-semibold">Invite summary</h2>
                <p className="mt-0.5 text-[9px] text-(--text-secondary)">{invitees.length} participant{invitees.length === 1 ? "" : "s"} added</p>
              </div>
            </div>
            <div className="mt-4 rounded-[12px] border border-(--border) bg-(--surface-soft) px-3 py-3 text-[10px] text-(--text-secondary)">
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 size-3.5 shrink-0 text-ember" />
                <span className="leading-4">Invites are sent after scheduling.</span>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
