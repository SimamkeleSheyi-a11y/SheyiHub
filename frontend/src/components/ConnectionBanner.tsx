import { CloudOff, Loader2, Wifi } from "lucide-react";

import { useRealtimeStore } from "@/stores/realtimeStore";

export function ConnectionBanner() {
  const status = useRealtimeStore((s) => s.status);
  const reconnectAttempt = useRealtimeStore((s) => s.reconnectAttempt);

  if (status === "connected" || status === "offline") return null;

  return (
    <div className="border-b border-amber-400/15 bg-amber-400/[0.07] px-3 py-2 text-amber-100 md:px-5">
      <div className="mx-auto flex max-w-[1520px] items-center gap-2 text-[10px] sm:text-xs">
        {status === "connecting" ? <Loader2 className="size-3.5 animate-spin" /> : <CloudOff className="size-3.5" />}
        <span className="font-medium">
          {status === "connecting"
            ? "Connecting realtime…"
            : `Realtime connection interrupted. Reconnecting${reconnectAttempt ? ` (attempt ${reconnectAttempt})` : ""}…`}
        </span>
        <span className="ml-auto hidden items-center gap-1 text-amber-100/60 sm:flex">
          <Wifi className="size-3" /> Messages still fall back to the API when possible.
        </span>
      </div>
    </div>
  );
}
