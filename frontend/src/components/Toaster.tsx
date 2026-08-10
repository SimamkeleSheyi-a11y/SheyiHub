import { CheckCircle2, Info, X, XCircle } from "lucide-react";

import { cn } from "@/lib/cn";
import { useToastStore, type ToastType } from "@/stores/toastStore";

const icons: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const borderClasses: Record<ToastType, string> = {
  success: "border-l-signal",
  error: "border-l-rust",
  info: "border-l-ember",
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => {
        const Icon = icons[t.type];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "animate-fade-in flex items-start gap-2 rounded-md border-l-4 bg-(--surface-raised) p-3",
              "shadow-[var(--shadow-elevation-4)] text-sm text-(--text-primary)",
              borderClasses[t.type]
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="text-(--text-secondary) hover:text-(--text-primary)"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
