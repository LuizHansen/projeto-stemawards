import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SyncButton from "./sync-button";

export default async function DashboardPage() {
  const user = await requireUser();

  const userGames = await prisma.userGame.findMany({
    where: { userId: user.id },
    include: { game: true },
    orderBy: { playtimeMinutes: "desc" },
  });

  const totalGames = userGames.length;
  const totalAchievements = userGames.reduce((sum, g) => sum + g.achievementsTotal, 0);
  const totalUnlocked = userGames.reduce((sum, g) => sum + g.achievementsUnlocked, 0);
  const totalRemaining = totalAchievements - totalUnlocked;
  const overallPercent = totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0;

  const mostAdvanced = [...userGames]
    .filter((g) => g.achievementsTotal > 0)
    .sort(
      (a, b) =>
        b.achievementsUnlocked / b.achievementsTotal - a.achievementsUnlocked / a.achievementsTotal,
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          {user.avatarUrl && (
            <Image
              src={user.avatarUrl}
              alt={user.username}
              width={48}
              height={48}
              className="rounded-full"
            />
          )}
          <div>
            <h1 className="text-xl font-semibold">{user.username}</h1>
            <p className="text-sm text-zinc-400">SteamID: {user.steamId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/family" className="text-sm text-zinc-400 hover:text-zinc-200">
            Família
          </Link>
          <SyncButton />
          <form action="/api/auth/logout" method="post">
            <button className="text-sm text-zinc-400 hover:text-zinc-200">Sair</button>
          </form>
        </div>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard label="Jogos" value={totalGames} />
        <StatCard label="Conquistas obtidas" value={totalUnlocked} />
        <StatCard label="Conquistas restantes" value={totalRemaining} />
        <StatCard label="Conclusão geral" value={`${overallPercent.toFixed(1)}%`} />
      </section>

      {userGames.length === 0 ? (
        <p className="text-zinc-400">
          Nenhum jogo sincronizado ainda. Clique em &quot;Atualizar Progresso&quot; para
          importar sua biblioteca Steam.
        </p>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-4">Jogos mais avançados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
            {mostAdvanced.map((ug) => (
              <GameCard key={ug.id} userGame={ug} />
            ))}
          </div>

          <h2 className="text-lg font-semibold mb-4">Biblioteca</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {userGames.map((ug) => (
              <GameCard key={ug.id} userGame={ug} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
      <p className="text-sm text-zinc-400">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function GameCard({
  userGame,
}: {
  userGame: {
    id: string;
    achievementsTotal: number;
    achievementsUnlocked: number;
    playtimeMinutes: number;
    game: { appId: number; name: string; headerUrl: string | null };
  };
}) {
  const percent =
    userGame.achievementsTotal > 0
      ? (userGame.achievementsUnlocked / userGame.achievementsTotal) * 100
      : 0;

  return (
    <Link
      href={`/games/${userGame.game.appId}`}
      className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden hover:border-zinc-600 transition-colors"
    >
      {userGame.game.headerUrl && (
        <Image
          src={userGame.game.headerUrl}
          alt={userGame.game.name}
          width={460}
          height={215}
          className="w-full h-24 object-cover"
        />
      )}
      <div className="p-3">
        <p className="text-sm font-medium truncate">{userGame.game.name}</p>
        <p className="text-xs text-zinc-400 mb-2">
          {Math.round(userGame.playtimeMinutes / 60)}h jogadas
        </p>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-xs text-zinc-400 mt-1">
          {userGame.achievementsUnlocked}/{userGame.achievementsTotal} ({percent.toFixed(0)}%)
        </p>
      </div>
    </Link>
  );
}
