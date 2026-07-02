import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-zinc-100">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30 text-emerald-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 4h12v3a6 6 0 0 1-5 5.917V16h2.5a1 1 0 0 1 1 1v2H7.5v-2a1 1 0 0 1 1-1H11v-3.083A6 6 0 0 1 6 7V4Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="font-display text-lg font-bold tracking-tight">
          Steam<span className="text-emerald-400">Awards</span>
        </span>
      </div>

      <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-center max-w-xl leading-tight">
        Sua central de conquistas Steam,{" "}
        <span className="text-emerald-400">organizada e sem esforço</span>
      </h1>
      <p className="text-zinc-400 max-w-md text-center">
        Conecte sua conta Steam para acompanhar sua biblioteca, o progresso de conquistas e guias
        gerados por IA para destravar tudo o que falta.
      </p>

      <a
        href="/api/auth/steam"
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold px-6 py-3 transition-colors shadow-lg shadow-emerald-500/20"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-9.9 8.6l5.3 2.2a2.8 2.8 0 0 1 1.6-.5h.1l2.4-3.4v-.1a3.7 3.7 0 1 1 3.7 3.7h-.1l-3.4 2.4v.1a2.8 2.8 0 0 1-5.5.8L2.3 14A10 10 0 1 0 12 2Zm-3.3 15.2 1.3.5a2.1 2.1 0 1 0 1.2-4l-1.4-.5a2.8 2.8 0 0 1-1.1 4Zm7.6-6.3a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        </svg>
        Entrar com Steam
      </a>
    </div>
  );
}
