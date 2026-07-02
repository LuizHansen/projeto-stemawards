import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFamilyOverview } from "@/lib/family";
import RadialProgress from "@/components/charts/radial-progress";
import TopNav from "@/components/top-nav";
import SyncButton from "./sync-button";
import DashboardLibrary from "./dashboard-library";

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

  const members = familyOverview
    ? familyOverview.members
    : [{ userId: user.id, username: user.username, avatarUrl: user.avatarUrl }];

  const libGames = familyOverview
    ? familyOverview.games.map((g) => ({
        gameId: g.gameId,
        appId: g.appId,
        name: g.name,
        owners: g.owners.map((o) => ({
          userId: o.userId,
          username: o.username,
          achievementsUnlocked: o.achievementsUnlocked,
          achievementsTotal: o.achievementsTotal,
        })),
      }))
    : userGames.map((ug) => ({
        gameId: ug.game.id,
        appId: ug.game.appId,
        name: ug.game.name,
        owners: [
          {
            userId: user.id,
            username: user.username,
            achievementsUnlocked: ug.achievementsUnlocked,
            achievementsTotal: ug.achievementsTotal,
          },
        ],
      }));

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

        {libGames.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
            <p className="text-zinc-400">
              Nenhum jogo sincronizado ainda. Clique em{" "}
              <span className="text-emerald-400 font-medium">Atualizar Progresso</span> para importar
              sua biblioteca Steam.
            </p>
          </div>
        ) : (
          <DashboardLibrary
            members={members}
            games={libGames}
            currentUserId={user.id}
            isFamily={Boolean(familyOverview)}
          />
        )}
      </div>
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
