import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { LogoutButton } from "@/components/logout-button";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-5 lg:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-950">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-500 text-white"><LayoutDashboard className="size-4" /></span>
          CollabBoard
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="hidden sm:inline">{email}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

