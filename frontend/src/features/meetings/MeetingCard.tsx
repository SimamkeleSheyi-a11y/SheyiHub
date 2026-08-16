import { CalendarDays, Clock3, Radio, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";
import type { Meeting } from "@/types/meeting";

const statusTone = { scheduled: "neutral", live: "signal", ended: "neutral", cancelled: "rust" } as const;

function formatMeetingDate(value: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (value.toDateString() === today.toDateString()) return "Today";
  if (value.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return value.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const start = new Date(meeting.scheduled_start);
  const end = new Date(meeting.scheduled_end);
  const isLive = meeting.status === "live";

  return (
    <Link to={`/meetings/${meeting.id}`} className="block rounded-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember">
      <Card
        interactive
        className={cn(
          "group relative overflow-hidden p-3.5 sm:p-4",
          isLive && "border-signal/25 bg-[linear-gradient(110deg,rgba(53,209,139,.065),var(--surface-raised)_35%)]"
        )}
      >
        {isLive ? <div className="absolute inset-y-0 left-0 w-[2px] bg-signal shadow-[0_0_16px_rgba(53,209,139,.8)]" /> : null}
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-[12px] border",
              isLive ? "border-signal/20 bg-signal/10 text-signal" : "border-ember/12 bg-ember/9 text-ember"
            )}
          >
            {isLive ? <Radio className="size-[18px]" /> : <CalendarDays className="size-[18px]" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <p className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold tracking-[-0.02em] sm:text-sm">
                {meeting.title}
              </p>
              <Badge tone={statusTone[meeting.status]}>{meeting.status}</Badge>
            </div>

            <div className="mt-2 grid gap-1.5 text-[9.5px] text-(--text-secondary) sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1 sm:text-[10px]">
              <span className="flex min-w-0 items-center gap-1.5">
                <Clock3 className="size-3.5 shrink-0" />
                <span className="truncate">
                  {formatMeetingDate(start)} · {start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}–
                  {end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <UserRound className="size-3.5 shrink-0" />
                <span className="truncate">Hosted by {meeting.host.display_name}</span>
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 sm:mt-2.5">
              <div>{meeting.my_invite_status ? <Badge tone="ember">{meeting.my_invite_status}</Badge> : null}</div>
              <span className="text-[10px] font-semibold text-ember sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                Open meeting →
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
