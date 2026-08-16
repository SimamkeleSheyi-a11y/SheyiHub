import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[16px] border border-dashed border-(--border) bg-(--surface-soft)/45 px-5 py-9 text-center sm:py-12">
      <Icon className="size-7 text-ember/70 sm:size-8" aria-hidden />
      <h3 className="font-display text-sm font-semibold text-(--text-primary) sm:text-base">{title}</h3>
      {description ? <p className="max-w-xs text-[11px] leading-5 text-(--text-secondary) sm:text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
