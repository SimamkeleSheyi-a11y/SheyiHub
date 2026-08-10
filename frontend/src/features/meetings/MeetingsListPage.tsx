import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Inbox } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { MeetingCard } from "@/features/meetings/MeetingCard";
import { meetingsApi, type MeetingScope } from "@/features/meetings/api";
import { cn } from "@/lib/cn";

const tabs: { value: MeetingScope; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "history", label: "History" },
  { value: "cancelled", label: "Cancelled" },
];

export function MeetingsListPage() {
  const [tab, setTab] = useState<MeetingScope>("upcoming");
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["meetings", tab],
    queryFn: () => meetingsApi.list(tab),
  });

  const meetings = Array.isArray(data) ? data : (data?.results ?? []);

  const emptyTitle =
    tab === "upcoming" ? "No meetings yet" : tab === "history" ? "No past meetings" : "No cancelled meetings";
  const emptyDescription =
    tab === "upcoming"
      ? "Schedule one to get your team together."
      : tab === "history"
        ? "Meetings you attend will show up here."
        : "Cancelled meetings will appear here for reference.";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--text-primary)">Meetings</h1>
        <Button onClick={() => navigate("/meetings/schedule")}>
          <CalendarPlus className="size-4" /> Schedule
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-(--border)">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.value
                ? "border-ember text-(--text-primary)"
                : "border-transparent text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : isError ? (
        <ErrorBanner message="Couldn't load your meetings. Try refreshing." />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={emptyTitle}
          description={emptyDescription}
          action={
            tab === "upcoming" ? (
              <Button variant="secondary" onClick={() => navigate("/meetings/schedule")}>
                Schedule a meeting
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          {meetings.map((meeting) => (
            <MeetingCard key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}
    </div>
  );
}
