import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";
interface CardProps extends HTMLAttributes<HTMLDivElement> { interactive?: boolean; }
export const Card = forwardRef<HTMLDivElement, CardProps>(({ interactive, className, children, ...props }, ref) => (
  <div ref={ref} className={cn("premium-panel rounded-[16px] p-4", interactive && "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-ember/35 hover:shadow-[var(--shadow-elevation-2)]", className)} {...props}>{children}</div>
));
Card.displayName = "Card";
