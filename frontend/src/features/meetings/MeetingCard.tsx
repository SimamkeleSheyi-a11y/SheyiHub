import { Clock } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import type { Meeting } from "@/types/meeting";

const statusTone = {
  scheduled: "neutral",
  live: "signal",
  ended: "neutral",
  cancelled: "rust",
} as const;

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const start = new Date(meeting.scheduled_start);

  return (
    <Link to={`/meetings/${meeting.id}`}>
      <Card interactive className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-(--text-primary)">{meeting.title}</p>
          <p className="flex items-center gap-1 text-sm text-(--text-secondary)">
            <Clock className="size-3.5" aria-hidden />
            {start.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={statusTone[meeting.status]}>{meeting.status}</Badge>
          {meeting.my_invite_status ? <Badge tone="ember">{meeting.my_invite_status}</Badge> : null}
        </div>
      </Card>
    </Link>
  );
}
