import { AlertTriangle } from "lucide-react";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-md border border-rust/30 bg-rust/10 px-3 py-2 text-sm text-rust"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
