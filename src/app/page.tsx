import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-zinc-950 text-zinc-100">
      <h1 className="text-4xl font-bold tracking-tight">Steam Achievement Guide</h1>
      <p className="text-zinc-400 max-w-md text-center">
        Conecte sua conta Steam para visualizar sua biblioteca, acompanhar o
        progresso de conquistas e descobrir guias para destravar tudo o que falta.
      </p>
      <a
        href="/api/auth/steam"
        className="rounded-full bg-[#1b2838] hover:bg-[#2a475e] text-white font-medium px-6 py-3 transition-colors"
      >
        Entrar com Steam
      </a>
    </div>
  );
}
