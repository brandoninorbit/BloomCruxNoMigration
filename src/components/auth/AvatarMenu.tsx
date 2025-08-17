"use client";
import { useUser, useSessionContext } from "@supabase/auth-helpers-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { forceSignOut } from "@/lib/auth/clientSignOut";

export default function AvatarMenu() {
  const user = useUser();
  const { isLoading } = useSessionContext();
  // Supabase client not needed here; forceSignOut handles both server and client

  if (!user || isLoading) return null;

  const meta = (user.user_metadata ?? {}) as { avatar_url?: string; picture?: string; full_name?: string };
  const avatarUrl = meta.avatar_url || meta.picture || undefined;
  const displayName = meta.full_name || user.email || "User";
  const initial = (user.email?.[0] ?? "U").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Account menu" className="rounded-full focus:outline-none">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarUrl} alt={displayName} />
            <AvatarFallback>{initial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col">
            <span className="text-sm font-medium leading-none">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <Link href="/dashboard">
          <DropdownMenuItem className="cursor-pointer">Dashboard</DropdownMenuItem>
        </Link>
        <Link href="/decks">
          <DropdownMenuItem className="cursor-pointer">My Decks</DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 cursor-pointer"
          onClick={() => forceSignOut("/")}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
