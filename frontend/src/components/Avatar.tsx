import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
type AvatarSize = "sm" | "md" | "lg" | "xl";
const sizeClasses: Record<AvatarSize, string> = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm", xl: "size-20 text-xl" };
export function Avatar({ name, src, size = "md", className }: { name: string; src?: string; size?: AvatarSize; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const cleanSrc = src?.trim() ?? "";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";
  const showImage = Boolean(cleanSrc) && !imageFailed;
  return <span className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[#7256ff] to-[#a33ce7] font-semibold text-white shadow-[0_7px_22px_rgba(89,57,191,.2)]", sizeClasses[size], className)} aria-label={`${name || "User"} avatar`}>
    {showImage ? <img src={cleanSrc} alt="" className="size-full object-cover" onError={() => setImageFailed(true)} referrerPolicy="no-referrer" /> : <span aria-hidden>{initials}</span>}
  </span>;
}
