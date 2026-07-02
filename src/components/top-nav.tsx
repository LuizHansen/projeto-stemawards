import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

type NavKey = "biblioteca" | "familia";

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative rounded-md px-3 py-1.5 text-sm transition-colors ${
        active ? "text-white" : "text-zinc-400 hover:text-zinc-100"
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-emerald-400" />
      )}
    </Link>
  );
}

export default function TopNav({
  user,
  active,
  actions,
}: {
  user: { username: string; avatarUrl: string | null };
  active?: NavKey;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#090b0e]/80 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 px-6 min-h-16 py-2.5">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30 text-emerald-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 4h12v3a6 6 0 0 1-5 5.917V16h2.5a1 1 0 0 1 1 1v2H7.5v-2a1 1 0 0 1 1-1H11v-3.083A6 6 0 0 1 6 7V4Z"
                  fill="currentColor"
                />
                <path
                  d="M6 5H3.5v1.5A2.5 2.5 0 0 0 6 9M18 5h2.5v1.5A2.5 2.5 0 0 1 18 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                />
              </svg>
            </span>
            <span className="font-display font-bold tracking-tight text-[15px] hidden sm:block">
              Steam<span className="text-emerald-400">Awards</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/dashboard" label="Biblioteca" active={active === "biblioteca"} />
            <NavLink href="/family" label="Família" active={active === "familia"} />
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <div className="hidden md:flex items-center gap-2 pl-1">
            {user.avatarUrl && (
              <Image
                src={user.avatarUrl}
                alt={user.username}
                width={30}
                height={30}
                className="rounded-full ring-1 ring-white/10"
              />
            )}
            <span className="text-sm text-zinc-300 max-w-[9rem] truncate">{user.username}</span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className={buttonClasses("ghost", "sm")} type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
