import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Clock3, Inbox, Radio, Search } from "lucide-react";
import { useMemo, useState } from "react";
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
  { value: "history", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

export function MeetingsListPage() {
  const [tab, setTab] = useState<MeetingScope>("upcoming");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["meetings", tab],
    queryFn: () => meetingsApi.list(tab),
  });

  const meetings = useMemo(() => (Array.isArray(data) ? data : (data?.results ?? [])), [data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle
      ? meetings.filter((m) => [m.title, m.host.display_name].some((v) => v.toLowerCase().includes(needle)))
      : meetings;
  }, [meetings, search]);

  const liveCount = meetings.filter((meeting) => meeting.status === "live").length;
  const nextMeeting = meetings.find((meeting) => meeting.status === "scheduled") ?? meetings[0];
  const emptyTitle =
    tab === "upcoming" ? "No meetings yet" : tab === "history" ? "No past meetings" : "No cancelled meetings";
  const emptyDescription =
    tab === "upcoming"
      ? "Schedule one to get your team together."
      : tab === "history"
        ? "Meetings you attend will show up here."
        : "Cancelled meetings will appear here for reference.";

  return (
    <div className="flex flex-col gap-4 pb-2 sm:gap-5">
      <section className="relative overflow-hidden rounded-[18px] border border-(--border) bg-(--surface-raised) p-4 shadow-[var(--shadow-elevation-1)] sm:p-5 lg:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-[#845cff]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ember">
              <CalendarDays className="size-3.5" />
              Collaboration
            </div>
            <h1 className="font-display text-[24px] font-semibold tracking-[-0.045em] sm:text-[28px]">Meetings</h1>
            <p className="mt-1 max-w-xl text-[11px] leading-5 text-(--text-secondary) sm:text-xs">
              Plan, join and review every team session from one place.
            </p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => navigate("/meetings/schedule")}>
            <CalendarPlus className="size-4" />
            New meeting
          </Button>
        </div>

        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-[13px] border border-(--border) bg-(--surface-soft)/70 p-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-(--text-secondary)">In this view</p>
            <p className="mt-1 font-display text-xl font-semibold">{meetings.length}</p>
          </div>
          <div className="rounded-[13px] border border-(--border) bg-(--surface-soft)/70 p-3">
            <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-(--text-secondary)">
              <Radio className="size-3 text-signal" /> Live now
            </p>
            <p className="mt-1 font-display text-xl font-semibold">{liveCount}</p>
          </div>
          <div className="col-span-2 rounded-[13px] border border-(--border) bg-(--surface-soft)/70 p-3 sm:col-span-1">
            <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-(--text-secondary)">
              <Clock3 className="size-3 text-ember" /> Next
            </p>
            <p className="mt-1 truncate text-[11px] font-semibold">{nextMeeting?.title ?? "Nothing scheduled"}</p>
          </div>
        </div>
      </section>

      <section className="premium-panel overflow-hidden rounded-[18px]">
        <div className="flex flex-col gap-3 border-b border-(--border) p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="hide-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-[10px] bg-(--surface-soft) p-1">
            {tabs.map((item) => (
              <button
                key={item.value}
                onClick={() => setTab(item.value)}
                className={cn(
                  "min-h-9 shrink-0 rounded-[8px] px-3 py-1.5 text-[10px] font-semibold transition-colors",
                  tab === item.value ? "bg-(--surface-raised) text-(--text-primary) shadow-sm" : "text-(--text-secondary)"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-(--border) bg-(--surface-soft) px-3 sm:h-9 sm:w-72">
            <Search className="size-3.5 shrink-0 text-(--text-secondary)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings..."
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-(--text-secondary)"
            />
          </div>
        </div>

        <div className="p-2.5 sm:p-4">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
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
          ) : filtered.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center px-4 text-center">
              <Search className="size-6 text-ember" />
              <p className="mt-3 text-xs font-semibold">No matching meetings</p>
              <p className="mt-1 text-[10px] text-(--text-secondary)">Try another meeting title or host.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
