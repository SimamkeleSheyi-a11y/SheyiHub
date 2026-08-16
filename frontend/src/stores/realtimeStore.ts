import { create } from "zustand";

export type RealtimeState = "offline" | "connecting" | "connected" | "reconnecting";

interface RealtimeStatusState {
  status: RealtimeState;
  reconnectAttempt: number;
  setStatus: (status: RealtimeState, reconnectAttempt?: number) => void;
}

export const useRealtimeStore = create<RealtimeStatusState>((set) => ({
  status: "offline",
  reconnectAttempt: 0,
  setStatus: (status, reconnectAttempt = 0) => set({ status, reconnectAttempt }),
}));
