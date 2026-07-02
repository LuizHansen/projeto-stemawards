import { requireUser } from "@/lib/auth";
import TopNav from "@/components/top-nav";
import FamilyClient from "./family-client";

export default async function FamilyPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen text-zinc-100">
      <TopNav user={user} active="familia" />
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight mb-2">Família Steam</h1>
        <p className="text-zinc-400 text-sm mb-8 max-w-2xl">
          Como a Steam não expõe oficialmente os jogos compartilhados via Family Sharing, cada
          membro da família precisa logar com a própria conta Steam aqui. O app combina as
          bibliotecas de todos que entrarem no mesmo grupo.
        </p>
        <FamilyClient currentUserId={user.id} />
      </div>
    </div>
  );
}
