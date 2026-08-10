export type LiveParticipantRole = "host" | "participant";
export type LiveParticipantStatus = "waiting" | "admitted" | "denied";

export interface LiveParticipant {
  user_id: string;
  display_name: string;
  avatar_url: string;
  role: LiveParticipantRole;
  status: LiveParticipantStatus;
  joined_at: string | null;
  mic_enabled?: boolean;
  camera_enabled?: boolean;
  screen_sharing?: boolean;
}
