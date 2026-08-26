"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountHeader } from "./AccountHeader";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/world/select", label: "Worlds" },
  { href: "/battle", label: "Battle" },
  { href: "/monsters", label: "Monsters" },
  { href: "/team", label: "Team" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/profile", label: "Profile" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-sm">
              ⛓️
            </span>
            <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              ChainMon
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-slate-800 text-amber-300"
                      : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <AccountHeader />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        ChainMon · Public Playtest · Personal Trainer progress
      </footer>
    </div>
  );
}
