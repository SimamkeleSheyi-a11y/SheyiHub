import { type HTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border border-(--border) bg-(--surface-raised) p-4 shadow-[var(--shadow-elevation-1)]",
        interactive && "cursor-pointer transition-shadow hover:shadow-[var(--shadow-elevation-2)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";
