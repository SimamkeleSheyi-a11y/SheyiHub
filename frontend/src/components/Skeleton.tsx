import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-stone-200 dark:bg-white/10", className)} aria-hidden />
  );
}
