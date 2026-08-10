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
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-(--border) py-12 text-center">
      <Icon className="size-8 text-stone-400" aria-hidden />
      <h3 className="font-display text-base font-semibold text-(--text-primary)">{title}</h3>
      {description ? <p className="max-w-xs text-sm text-(--text-secondary)">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
