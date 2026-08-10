import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef, useId } from "react";

import { cn } from "@/lib/cn";

const fieldBase =
  "w-full rounded-md border bg-(--surface-raised) px-3 text-sm text-(--text-primary) " +
  "placeholder:text-(--text-secondary) transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ember disabled:opacity-50";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapperProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-(--text-primary)">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={fieldId}
          className={cn(
            fieldBase,
            "h-10",
            error ? "border-rust focus-visible:ring-rust" : "border-(--border)",
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
          {...props}
        />
        {error ? (
          <p id={`${fieldId}-error`} className="text-sm text-rust">
            {error}
          </p>
        ) : hint ? (
          <p id={`${fieldId}-hint`} className="text-sm text-(--text-secondary)">
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapperProps {}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label htmlFor={fieldId} className="text-sm font-medium text-(--text-primary)">
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(fieldBase, "min-h-22 py-2", error ? "border-rust" : "border-(--border)", className)}
          aria-invalid={!!error}
          {...props}
        />
        {error ? (
          <p className="text-sm text-rust">{error}</p>
        ) : hint ? (
          <p className="text-sm text-(--text-secondary)">{hint}</p>
        ) : null}
      </div>
    );
  }
);
TextArea.displayName = "TextArea";
