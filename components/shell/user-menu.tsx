"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommands } from "@/components/ui/command-palette";

export interface UserMenuProps {
  name: string;
  email: string;
  collapsed?: boolean;
}

export function UserMenu({ name, email, collapsed = false }: UserMenuProps) {
  const router = useRouter();

  const signOut = React.useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }, [router]);

  useCommands(
    "user-menu",
    React.useMemo(
      () => [{ id: "sign-out", label: "Sign out", group: "Account", icon: LogOut, onSelect: signOut }],
      [signOut],
    ),
  );

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-control-height min-w-0 items-center gap-2 rounded-md px-2",
            "transition-instant transition-colors hover:bg-ink-200",
            collapsed ? "w-control-height justify-center px-0" : "w-full",
            focusRing,
          )}
        >
          <Avatar fallback={initials} size="sm" />
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate text-left text-label text-fg-000">{name}</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-fg-000">{name}</span>
          <span className="font-normal text-fg-200">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4 text-fg-200" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
