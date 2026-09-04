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
    <div className="flex min-h-screen flex-col bg-[#050b17]">
      <header className="sticky top-0 z-40 border-b-2 border-slate-800 bg-[#07101f]">
        <div className="mx-auto flex h-14 w-full max-w-[76rem] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center gap-2">
            <span className="border border-amber-300/80 bg-amber-300 px-1.5 py-1 font-mono text-xs font-black text-slate-950">CM</span>
            <span className="font-mono text-base font-black uppercase tracking-[0.08em] text-slate-100">
              ChainMon
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`border px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.05em] transition-colors ${
                    active
                      ? "border-amber-300/80 bg-amber-300/10 text-amber-100"
                      : "border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-900 hover:text-slate-100"
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

      <main className="mx-auto w-full max-w-[76rem] flex-1 px-4 py-5 pb-24 sm:px-6 sm:py-7 md:pb-7">{children}</main>

      <footer className="border-t border-slate-800 py-5 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-slate-600">
        ChainMon · Protocol Rift · Monad Testnet
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t-2 border-slate-700 bg-[#07101f] px-1 py-1 md:hidden" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`min-w-0 border px-1 py-2 text-center font-mono text-[8px] font-black uppercase leading-3 tracking-tight ${
                active
                  ? "border-amber-300/80 bg-amber-300/10 text-amber-100"
                  : "border-transparent text-slate-500"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
