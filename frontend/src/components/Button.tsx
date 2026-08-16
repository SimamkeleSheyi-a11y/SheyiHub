import { Loader2 } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; isLoading?: boolean; }
const variantClasses: Record<Variant, string> = {
  primary: "border border-transparent bg-gradient-to-r from-[#7657ff] to-[#963ff0] text-white shadow-[0_10px_30px_rgba(118,87,255,.22)] hover:brightness-110 active:scale-[.985]",
  secondary: "border border-(--border-strong) bg-(--surface-raised) text-(--text-primary) hover:border-ember/55 hover:bg-ember/8 active:scale-[.985]",
  ghost: "border border-transparent bg-transparent text-(--text-secondary) hover:bg-ember/8 hover:text-(--text-primary)",
  destructive: "border border-rust/30 bg-rust/12 text-rust hover:bg-rust/18 active:scale-[.985]",
};
const sizeClasses: Record<Size, string> = { sm: "h-9 px-3 text-xs gap-1.5 sm:h-8", md: "h-10 px-4 text-sm gap-2", lg: "h-12 px-5 text-sm gap-2" };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ variant = "primary", size = "md", isLoading, disabled, className, children, ...props }, ref) => (
  <button ref={ref} disabled={disabled || isLoading} className={cn("inline-flex items-center justify-center rounded-[10px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember focus-visible:ring-offset-2 focus-visible:ring-offset-(--surface) disabled:pointer-events-none disabled:opacity-40", variantClasses[variant], sizeClasses[size], className)} {...props}>
    {isLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}{children}
  </button>
));
Button.displayName = "Button";
