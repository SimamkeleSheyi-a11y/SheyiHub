import { cn } from "@/lib/cn";
import { usePresence } from "@/stores/presenceStore";

export function PresenceDot({ userId, className }: { userId: string; className?: string }) {
  const presence = usePresence(userId);
  const isOnline = presence?.status === "online";

  return (
    <span
      className={cn(
        "size-2.5 rounded-full ring-2 ring-(--surface-raised)",
        isOnline ? "bg-signal" : "bg-stone-400",
        className
      )}
      role="img"
      aria-label={isOnline ? "Online" : "Offline"}
    />
  );
}
