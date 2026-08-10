import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Tone = "neutral" | "ember" | "signal" | "rust";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700 dark:bg-white/10 dark:text-stone-200",
  ember: "bg-ember/15 text-ember-dark dark:text-ember",
  signal: "bg-signal/15 text-signal",
  rust: "bg-rust/15 text-rust",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
