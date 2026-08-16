import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md";
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({ isOpen, onClose, title, children, size = "sm" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    triggerElement.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables?.[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !focusables?.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (triggerElement.current as HTMLElement | null)?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--scrim)] p-0 backdrop-blur-[5px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "max-h-[92dvh] w-full overflow-y-auto rounded-t-[22px] border border-b-0 border-(--border) bg-(--surface-raised) px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-elevation-4)] sm:max-h-[88vh] sm:rounded-[18px] sm:border sm:p-6",
          size === "sm" ? "sm:max-w-[480px]" : "sm:max-w-[680px]"
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-(--border-strong) sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="modal-title" className="min-w-0 truncate font-display text-base font-semibold text-(--text-primary) sm:text-lg">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-(--text-secondary) transition-colors hover:bg-ember/8 hover:text-(--text-primary)"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
