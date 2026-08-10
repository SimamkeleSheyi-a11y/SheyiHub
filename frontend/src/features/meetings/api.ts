import { apiFetch } from "@/lib/apiClient";
import type { Conversation } from "@/types/messaging";
import type { WhiteboardSnapshot } from "@/types/whiteboard";
import type {
  InviteStatus,
  Meeting,
  MeetingDetail,
  MeetingFormInput,
  MeetingParticipant,
} from "@/types/meeting";

interface Paginated<T> {
  results: T[];
  count: number;
}

export type MeetingScope = "upcoming" | "history" | "cancelled";

export const meetingsApi = {
  list: (scope?: MeetingScope) =>
    apiFetch<Paginated<Meeting> | Meeting[]>(`/meetings/${scope ? `?scope=${scope}` : ""}`),

  detail: (id: string) => apiFetch<MeetingDetail>(`/meetings/${id}/`),

  create: (data: Partial<MeetingFormInput>) =>
    apiFetch<MeetingDetail>("/meetings/", { method: "POST", body: data }),

  update: (id: string, data: Partial<MeetingFormInput>) =>
    apiFetch<MeetingDetail>(`/meetings/${id}/`, { method: "PATCH", body: data }),

  cancel: (id: string) => apiFetch<void>(`/meetings/${id}/`, { method: "DELETE" }),

  start: (id: string) => apiFetch<MeetingDetail>(`/meetings/${id}/start/`, { method: "POST" }),

  end: (id: string) => apiFetch<MeetingDetail>(`/meetings/${id}/end/`, { method: "POST" }),

  conversation: (id: string) => apiFetch<Conversation>(`/meetings/${id}/conversation/`),

  whiteboard: (id: string) => apiFetch<WhiteboardSnapshot>(`/meetings/${id}/whiteboard/`),

  participants: (id: string) => apiFetch<MeetingParticipant[]>(`/meetings/${id}/participants/`),

  addParticipant: (id: string, email: string) =>
    apiFetch<MeetingParticipant>(`/meetings/${id}/participants/`, {
      method: "POST",
      body: { email },
    }),

  removeParticipant: (id: string, inviteId: string) =>
    apiFetch<void>(`/meetings/${id}/participants/${inviteId}/`, { method: "DELETE" }),

  respond: (id: string, response: "accept" | "decline") =>
    apiFetch<MeetingParticipant>(`/meetings/${id}/respond/`, {
      method: "POST",
      body: { response },
    }),
};

export function inviteStatusLabel(status: InviteStatus) {
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined";
  return "Pending";
}
