"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

export type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "size-6 text-meta",
  md: "size-8 text-label",
  lg: "size-10 text-body",
};

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string;
  alt?: string;
  fallback: string;
  size?: AvatarSize;
}

export const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, src, alt = "", fallback, size = "md", ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-ink-400 bg-ink-200 font-medium text-fg-100",
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      <AvatarPrimitive.Image src={src} alt={alt} className="size-full object-cover" />
      <AvatarPrimitive.Fallback delayMs={src ? 300 : 0} className="select-none">
        {fallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  ),
);
Avatar.displayName = "Avatar";

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: AvatarSize;
  avatars: { src?: string; alt?: string; fallback: string }[];
}

export const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, avatars, max = 4, size = "md", ...props }, ref) => {
    const visible = avatars.slice(0, max);
    const overflow = avatars.length - visible.length;

    return (
      <div ref={ref} className={cn("flex items-center -space-x-2", className)} {...props}>
        {visible.map((avatar, index) => (
          <Avatar
            key={`${avatar.fallback}-${index}`}
            src={avatar.src}
            alt={avatar.alt}
            fallback={avatar.fallback}
            size={size}
            className="ring-2 ring-ink-000"
          />
        ))}
        {overflow > 0 ? (
          <div
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center rounded-full border border-ink-400 bg-ink-200 font-medium text-fg-100 ring-2 ring-ink-000",
              SIZE_CLASSES[size],
            )}
          >
            +{overflow}
          </div>
        ) : null}
      </div>
    );
  },
);
AvatarGroup.displayName = "AvatarGroup";
