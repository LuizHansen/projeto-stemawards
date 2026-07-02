import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyOverview } from "@/lib/family";
import GameImage from "@/components/game-image";
import RadialProgress from "@/components/charts/radial-progress";
import TopNav from "@/components/top-nav";
import Badge from "@/components/ui/badge";
import SyncButton from "./sync-button";

export default async function DashboardPage() {
  const user = await requireUser();

  const userGames = await prisma.userGame.findMany({
    where: { userId: user.id },
    include: { game: true },
    orderBy: { playtimeMinutes: "desc" },
  });

  const familyOverview = await getFamilyOverview(user.id);

  // Top KPIs always reflect the logged-in user's own numbers (family-wide
  // comparison lives on the /family page instead).
  const totalGames = userGames.length;
  const totalAchievements = userGames.reduce((sum, g) => sum + g.achievementsTotal, 0);
  const totalUnlocked = userGames.reduce((sum, g) => sum + g.achievementsUnlocked, 0);
  const totalRemaining = totalAchievements - totalUnlocked;
  const overallPercent = totalAchievements > 0 ? (totalUnlocked / totalAchievements) * 100 : 0;
  const totalHours = Math.round(userGames.reduce((sum, g) => sum + g.playtimeMinutes, 0) / 60);

  const libraryCount = familyOverview ? familyOverview.games.length : userGames.length;

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
    <div className="min-h-screen text-zinc-100">
      <TopNav user={user} active="biblioteca" actions={<SyncButton />} />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <section className="mb-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row items-center gap-7">
            <div className="flex flex-col items-center shrink-0">
              <RadialProgress value={overallPercent} size={124} stroke={9}>
                <div className="text-center">
                  <p className="tnum text-2xl font-bold leading-none">
                    {overallPercent.toFixed(0)}
                    <span className="text-base text-zinc-500">%</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] mt-1">
                    Conclusão
                  </p>
                </div>
              </RadialProgress>
              <p className="text-xs text-zinc-500 mt-3">Seu progresso geral</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
              <StatCard label="Jogos" value={totalGames.toLocaleString("pt-BR")} />
              <StatCard label="Horas jogadas" value={`${totalHours.toLocaleString("pt-BR")}h`} />
              <StatCard label="Conquistas" value={totalUnlocked.toLocaleString("pt-BR")} />
              <StatCard label="Faltam" value={totalRemaining.toLocaleString("pt-BR")} />
            </div>
          </div>
        </section>

        {libraryCount === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <p className="text-zinc-400">
              Nenhum jogo sincronizado ainda. Clique em{" "}
              <span className="text-emerald-400 font-medium">Atualizar Progresso</span> para importar
              sua biblioteca Steam.
            </p>
          </div>
        ) : (
          <>
            <SectionHeader title="Jogos mais avançados" />
            <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-10 mb-14">
              {familyOverview
                ? familyMostAdvanced.map((game) => (
                    <FamilyGameCard key={game.gameId} game={game} currentUserId={user.id} />
                  ))
                : personalMostAdvanced.map((ug) => <GameCard key={ug.id} userGame={ug} />)}
            </div>

            <SectionHeader
              title={familyOverview ? "Biblioteca da família" : "Biblioteca"}
              count={libraryCount}
            />
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

function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
      {count != null && <Badge tone="neutral">{count.toLocaleString("pt-BR")}</Badge>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="tnum text-2xl font-bold mt-0.5">{value}</p>
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
