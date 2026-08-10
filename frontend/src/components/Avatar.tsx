import { useEffect, useState } from "react";

import { cn } from "@/lib/cn";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
  xl: "size-20 text-2xl",
};

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => setImageFailed(false), [src]);

  const cleanSrc = src?.trim() ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const showImage = Boolean(cleanSrc) && !imageFailed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pine font-semibold text-white",
        sizeClasses[size],
        className
      )}
      aria-label={`${name || "User"} avatar`}
    >
      {showImage ? (
        <img
          src={cleanSrc}
          alt=""
          className="size-full object-cover"
          onError={() => setImageFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  );
}
