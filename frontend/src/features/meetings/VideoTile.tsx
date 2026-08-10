import { MicOff, VideoOff } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

interface VideoTileProps {
  name: string;
  stream: MediaStream | null;
  muted?: boolean;
  micEnabled?: boolean;
  cameraEnabled?: boolean;
  isLocal?: boolean;
  className?: string;
}

export function VideoTile({
  name,
  stream,
  muted = false,
  micEnabled = true,
  cameraEnabled = true,
  isLocal = false,
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "relative min-h-48 overflow-hidden rounded-2xl border border-white/10 bg-stone-950 shadow-xl",
        className
      )}
    >
      {stream && cameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted || isLocal}
          className={cn("h-full w-full object-cover", isLocal && "-scale-x-100")}
        />
      ) : (
        <div className="flex h-full min-h-48 items-center justify-center bg-[radial-gradient(circle_at_top,#234339,#111814_70%)]">
          <div className="flex size-20 items-center justify-center rounded-full bg-ember/20 font-display text-2xl font-semibold text-ember">
            {initials || "?"}
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent p-3 pt-10 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}{isLocal ? " (You)" : ""}</p>
        </div>
        <div className="flex items-center gap-1">
          {!micEnabled ? (
            <span className="rounded-full bg-black/55 p-1.5" title="Microphone off">
              <MicOff className="size-3.5" />
            </span>
          ) : null}
          {!cameraEnabled ? (
            <span className="rounded-full bg-black/55 p-1.5" title="Camera off">
              <VideoOff className="size-3.5" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
