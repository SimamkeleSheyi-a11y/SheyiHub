import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";
type Tone = "neutral" | "ember" | "signal" | "rust";
const toneClasses: Record<Tone, string> = { neutral: "border-(--border) bg-(--surface-soft) text-(--text-secondary)", ember: "border-ember/16 bg-ember/10 text-ember", signal: "border-signal/18 bg-signal/10 text-signal", rust: "border-rust/18 bg-rust/10 text-rust" };
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> { tone?: Tone; }
export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) { return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold capitalize", toneClasses[tone], className)} {...props}>{children}</span>; }
