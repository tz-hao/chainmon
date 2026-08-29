"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AccountHeader } from "./AccountHeader";

const NAV_ITEMS = [
  { href: "/rift", label: "Protocol Rift" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/monsters", label: "Collection" },
  { href: "/team", label: "Team" },
  { href: "/battle", label: "Battle" },
  { href: "/marketplace", label: "Marketplace" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-800/90 bg-slate-950/80 shadow-[0_12px_30px_rgba(2,6,23,0.28)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,0.1)] transition group-hover:border-emerald-200/60 group-hover:bg-emerald-300/15">
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 2 5 6v8l7 8 7-8V6l-7-4Z" />
                <path d="m12 6-3 5 3 7 3-7-3-5Z" />
              </svg>
            </span>
            <span className="bg-gradient-to-r from-emerald-100 via-cyan-200 to-violet-200 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              ChainMon
            </span>
          </Link>
          <nav className="hidden items-center gap-1 rounded-2xl border border-slate-800/80 bg-slate-900/45 p-1 md:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition duration-200 ${
                    active
                      ? "bg-cyan-300/10 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,0.16)]"
                      : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
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

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6 sm:py-10">{children}</main>

      <footer className="border-t border-slate-800/80 py-6 text-center text-xs tracking-wide text-slate-600">
        ChainMon · Protocol Rift · Monad Testnet
      </footer>
    </div>
  );
}
