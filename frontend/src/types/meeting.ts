import type { User } from "@/types/user";

export type MeetingStatus = "scheduled" | "live" | "ended" | "cancelled";
export type InviteStatus = "pending" | "accepted" | "declined";

export interface MeetingParticipant {
  id: string;
  user: User;
  status: InviteStatus;
}

export interface Meeting {
  id: string;
  title: string;
  host: User;
  scheduled_start: string;
  scheduled_end: string;
  status: MeetingStatus;
  room_slug: string;
  waiting_room_enabled: boolean;
  my_invite_status: InviteStatus | null;
}

export interface MeetingDetail extends Meeting {
  actual_start: string | null;
  actual_end: string | null;
  created_at: string;
  invited_emails: string[];
  participants: MeetingParticipant[];
}

export interface MeetingFormInput {
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  waiting_room_enabled: boolean;
  invitee_emails: string[];
}
