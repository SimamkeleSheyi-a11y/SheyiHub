import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Inbox, Video } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import { meetingsApi } from "@/features/meetings/api";
import { MeetingCard } from "@/features/meetings/MeetingCard";
import { useAuthStore } from "@/stores/authStore";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: () => meetingsApi.list("upcoming"),
  });

  const startInstantMeeting = useMutation({
    mutationFn: () => {
      const now = new Date();
      return meetingsApi.create({
        title: `${user?.display_name}'s meeting`,
        scheduled_start: new Date(now.getTime() + 60_000).toISOString(),
        scheduled_end: new Date(now.getTime() + 60 * 60_000).toISOString(),
      });
    },
    onSuccess: (meeting) => {
      queryClient.invalidateQueries({ queryKey: ["meetings"] });
      navigate(`/meetings/${meeting.id}/room`);
    },
  });

  const meetings = Array.isArray(data) ? data : (data?.results ?? []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--text-primary)">
          Welcome back{user ? `, ${user.display_name}` : ""}
        </h1>
        <p className="text-sm text-(--text-secondary)">Here's what's coming up.</p>
      </div>

      <div className="flex gap-3">
        <Button onClick={() => startInstantMeeting.mutate()} isLoading={startInstantMeeting.isPending}>
          <Video className="size-4" /> Start meeting
        </Button>
        <Button variant="secondary" onClick={() => navigate("/meetings/schedule")}>
          <CalendarPlus className="size-4" /> Schedule
        </Button>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-(--text-primary)">Upcoming</h2>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : isError ? (
          <ErrorBanner message="Couldn't load your upcoming meetings. Try refreshing." />
        ) : meetings.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No meetings yet"
            description="Schedule one to get your team together."
            action={
              <Button variant="secondary" onClick={() => navigate("/meetings/schedule")}>
                Schedule a meeting
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-2">
            {meetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-(--text-primary)">Recent activity</h2>
        <Card className="text-sm text-(--text-secondary)">
          Recent chats and shared files will show up here — check{" "}
          <Link to="/chats" className="font-medium text-pine dark:text-ember hover:underline">
            Chats
          </Link>{" "}
          in the meantime.
        </Card>
      </section>
    </div>
  );
}
