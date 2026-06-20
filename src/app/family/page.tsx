import { requireUser } from "@/lib/auth";
import FamilyClient from "./family-client";

export default async function FamilyPage() {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <h1 className="text-2xl font-bold mb-6">Família Steam</h1>
      <p className="text-zinc-400 text-sm mb-8 max-w-2xl">
        Como a Steam não expõe oficialmente os jogos compartilhados via Family Sharing, cada
        membro da família precisa logar com a própria conta Steam aqui. O app combina as
        bibliotecas de todos que entrarem no mesmo grupo.
      </p>
      <FamilyClient currentUserId={user.id} />
    </div>
  );
}
