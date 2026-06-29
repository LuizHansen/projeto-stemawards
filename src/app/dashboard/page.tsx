import Link from "next/link";
import Image from "next/image";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyOverview } from "@/lib/family";
import GameImage from "@/components/game-image";
import SyncButton from "./sync-button";

export default async function DashboardPage() {
  const user = await requireUser();

  const userGames = await prisma.userGame.findMany({
    where: { userId: user.id },
    include: { game: true },
    orderBy: { playtimeMinutes: "desc" },
  });

  const familyOverview = await getFamilyOverview(user.id);

  let totalGames: number;
  let totalAchievements: number;
  let totalUnlocked: number;

  if (familyOverview) {
    // Family-wide KPIs: count each shared game once, using the best
    // progress any member has reached on it (avoids double-counting the
    // same achievements when multiple members own the same game).
    totalGames = familyOverview.games.length;
    totalAchievements = familyOverview.games.reduce(
      (sum, g) => sum + Math.max(0, ...g.owners.map((o) => o.achievementsTotal)),
      0,
    );
    totalUnlocked = familyOverview.games.reduce(
      (sum, g) => sum + Math.max(0, ...g.owners.map((o) => o.achievementsUnlocked)),
      0,
    );
  } else {
    totalGames = userGames.length;
    totalAchievements = userGames.reduce((sum, g) => sum + g.achievementsTotal, 0);
    totalUnlocked = userGames.reduce((sum, g) => sum + g.achievementsUnlocked, 0);
  }

  const totalRemaining = totalAchievements - totalUnlocked;
  const overallPercent = totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0;

  const familyMostAdvanced = familyOverview
    ? [...familyOverview.games]
        .filter((g) => g.owners.some((o) => o.achievementsTotal > 0))
        .sort((a, b) => {
          const bestPercent = (g: typeof a) =>
            Math.max(
              ...g.owners.map((o) =>
                o.achievementsTotal > 0 ? o.achievementsUnlocked / o.achievementsTotal : 0,
              ),
            );
          return bestPercent(b) - bestPercent(a);
        })
        .slice(0, 5)
    : [];

  const personalMostAdvanced = [...userGames]
    .filter((g) => g.achievementsTotal > 0)
    .sort(
      (a, b) =>
        b.achievementsUnlocked / b.achievementsTotal - a.achievementsUnlocked / a.achievementsTotal,
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 backdrop-blur-md bg-zinc-950/80 border-b border-zinc-800">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {user.avatarUrl && (
              <Image
                src={user.avatarUrl}
                alt={user.username}
                width={44}
                height={44}
                className="rounded-full"
              />
            )}
            <div>
              <h1 className="text-base font-semibold leading-tight">{user.username}</h1>
              <p className="text-xs text-zinc-500">SteamID: {user.steamId}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {familyOverview && (
              <Link
                href="/family#comparacao"
                className="rounded-full border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-sm font-medium px-4 py-2 transition-colors"
              >
                Comparar KPIs
              </Link>
            )}
            <Link href="/family" className="text-sm text-zinc-400 hover:text-zinc-200">
              Família
            </Link>
            <SyncButton />
            <form action="/api/auth/logout" method="post">
              <button className="text-sm text-zinc-400 hover:text-zinc-200">Sair</button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <StatCard label="Jogos" value={totalGames} />
          <StatCard label="Conquistas obtidas" value={totalUnlocked} />
          <StatCard label="Conquistas restantes" value={totalRemaining} />
          <StatCard label="Conclusão geral" value={`${overallPercent.toFixed(1)}%`} />
        </section>

        {totalGames === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
            <p className="text-zinc-400">
              Nenhum jogo sincronizado ainda. Clique em &quot;Atualizar Progresso&quot; para
              importar sua biblioteca Steam.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold mb-4">Jogos mais avançados</h2>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-10 mb-14">
              {familyOverview
                ? familyMostAdvanced.map((game) => (
                    <FamilyGameCard key={game.gameId} game={game} currentUserId={user.id} />
                  ))
                : personalMostAdvanced.map((ug) => <GameCard key={ug.id} userGame={ug} />)}
            </div>

            <h2 className="text-lg font-semibold mb-4">
              {familyOverview
                ? `Biblioteca da família (${familyOverview.games.length})`
                : "Biblioteca"}
            </h2>
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-10">
              {familyOverview
                ? familyOverview.games.map((game) => (
                    <FamilyGameCard key={game.gameId} game={game} currentUserId={user.id} />
                  ))
                : userGames.map((ug) => <GameCard key={ug.id} userGame={ug} />)}
            </div>
          </>
        )}
      </div>
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
    <Link href={`/games/${userGame.game.appId}`} className="group relative block">
      <div className="rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 transition-all duration-300 ease-out group-hover:scale-110 group-hover:z-20 group-hover:shadow-2xl group-hover:border-zinc-600">
        <div className="aspect-video w-full relative">
          <GameImage
            appId={userGame.game.appId}
            name={userGame.game.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="px-3 py-2">
          <p className="text-sm font-semibold leading-tight truncate">{userGame.game.name}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {Math.round(userGame.playtimeMinutes / 60)}h jogadas
          </p>
          <div className="max-h-0 opacity-0 group-hover:max-h-16 group-hover:opacity-100 overflow-hidden transition-all duration-300">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div className="h-full bg-emerald-400" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-zinc-300 mt-1.5">
              {userGame.achievementsUnlocked}/{userGame.achievementsTotal} conquistas (
              {percent.toFixed(0)}%)
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FamilyGameCard({
  game,
  currentUserId,
}: {
  game: {
    appId: number;
    name: string;
    headerUrl: string | null;
    owners: {
      userId: string;
      username: string;
      achievementsUnlocked: number;
      achievementsTotal: number;
    }[];
  };
  currentUserId: string;
}) {
  const ownedByMe = game.owners.some((o) => o.userId === currentUserId);
  const myProgress = game.owners.find((o) => o.userId === currentUserId);
  const bestProgress = game.owners.reduce(
    (best, o) =>
      o.achievementsTotal > 0 && o.achievementsUnlocked / o.achievementsTotal > best
        ? o.achievementsUnlocked / o.achievementsTotal
        : best,
    0,
  );

  const content = (
    <div
      className={`rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 transition-all duration-300 ease-out group-hover:scale-110 group-hover:z-20 group-hover:shadow-2xl ${
        ownedByMe ? "group-hover:border-zinc-600" : ""
      }`}
    >
      <div className="aspect-video w-full relative">
        <GameImage appId={game.appId} name={game.name} className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold leading-tight truncate">{game.name}</p>
        {myProgress ? (
          <p className="text-xs text-zinc-400 mt-0.5">
            Você:{" "}
            {myProgress.achievementsTotal > 0
              ? `${((myProgress.achievementsUnlocked / myProgress.achievementsTotal) * 100).toFixed(0)}%`
              : "0%"}
          </p>
        ) : (
          <p className="text-xs text-zinc-500 mt-0.5">
            Você não possui ·{" "}
            {bestProgress > 0 ? `melhor: ${(bestProgress * 100).toFixed(0)}%` : "0%"}
          </p>
        )}
        <div className="max-h-0 opacity-0 group-hover:max-h-24 group-hover:opacity-100 overflow-hidden transition-all duration-300">
          <div className="flex flex-wrap gap-1 mt-2">
            {game.owners.map((owner) => {
              const percent =
                owner.achievementsTotal > 0
                  ? (owner.achievementsUnlocked / owner.achievementsTotal) * 100
                  : 0;
              return (
                <span
                  key={owner.userId}
                  className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                    owner.userId === currentUserId
                      ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
                      : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                  }`}
                >
                  {owner.username}: {percent.toFixed(0)}%
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  if (!ownedByMe) {
    return <div className="group relative block opacity-75">{content}</div>;
  }

  return (
    <Link href={`/games/${game.appId}`} className="group relative block">
      {content}
    </Link>
  );
}
