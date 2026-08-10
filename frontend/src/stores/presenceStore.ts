import { create } from "zustand";

import type { PresenceStatus } from "@/types/messaging";

interface PresenceState {
  statuses: Record<string, { status: PresenceStatus; last_seen: string | null }>;
  setStatus: (userId: string, status: PresenceStatus, lastSeen?: string | null) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  statuses: {},
  setStatus: (userId, status, lastSeen = null) =>
    set((state) => ({
      statuses: { ...state.statuses, [userId]: { status, last_seen: lastSeen } },
    })),
}));

export function usePresence(userId: string | undefined) {
  return usePresenceStore((s) => (userId ? s.statuses[userId] : undefined));
}
