import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateDifficulty, type DifficultyLevel } from "@/lib/guides/difficulty";
import GameImage from "@/components/game-image";
import BackLink from "@/components/back-link";
import TopNav from "@/components/top-nav";
import Badge from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import AchievementGuide from "./achievement-guide";

const DIFFICULTY_ORDER: DifficultyLevel[] = [
  "Muito Fácil",
  "Fácil",
  "Médio",
  "Difícil",
  "Muito Difícil",
];

const DIFFICULTY_STYLES: Record<DifficultyLevel, string> = {
  "Muito Fácil": "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  Fácil: "bg-teal-500/10 text-teal-300 border-teal-500/25",
  Médio: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  Difícil: "bg-orange-500/10 text-orange-300 border-orange-500/25",
  "Muito Difícil": "bg-red-500/10 text-red-300 border-red-500/25",
};

function DifficultyPill({ level }: { level: DifficultyLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${DIFFICULTY_STYLES[level]}`}
    >
      {level}
    </span>
  );
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const user = await requireUser();
  const { appId } = await params;

  const game = await prisma.game.findUnique({
    where: { appId: Number(appId) },
    include: {
      achievements: { orderBy: { displayName: "asc" } },
    },
  });
  if (!game) notFound();

  const userGame = await prisma.userGame.findUnique({
    where: { userId_gameId: { userId: user.id, gameId: game.id } },
    include: { userAchievements: true },
  });
  if (!userGame) notFound();

  const unlockedByAchievementId = new Map(
    userGame.userAchievements.map((ua) => [ua.achievementId, ua]),
  );

  const percent =
    userGame.achievementsTotal > 0
      ? (userGame.achievementsUnlocked / userGame.achievementsTotal) * 100
      : 0;

  const unlockedAchievements = [];
  const pendingAchievements = [];

  for (const achievement of game.achievements) {
    const unlocked = unlockedByAchievementId.get(achievement.id)?.unlocked ?? false;
    if (unlocked) {
      unlockedAchievements.push(achievement);
    } else {
      pendingAchievements.push(achievement);
    }
  }

  pendingAchievements.sort(
    (a, b) => estimateDifficulty(a.globalPercent).score - estimateDifficulty(b.globalPercent).score,
  );

  const avgPendingScore =
    pendingAchievements.length > 0
      ? pendingAchievements.reduce(
          (sum, a) => sum + estimateDifficulty(a.globalPercent).score,
          0,
        ) / pendingAchievements.length
      : 0;
  const avgPendingDifficulty =
    pendingAchievements.length > 0
      ? DIFFICULTY_ORDER[Math.min(4, Math.round(avgPendingScore) - 1)]
      : null;

  return (
    <div className="min-h-screen text-zinc-100">
      <TopNav user={user} active="biblioteca" />

      <div className="max-w-4xl mx-auto px-6 py-8">
        <BackLink href="/dashboard" label="Voltar para a biblioteca" />

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden mb-8">
          <div className="relative">
            <GameImage appId={game.appId} name={game.name} className="w-full h-48 sm:h-56 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d10] via-[#0b0d10]/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-lg">
                {game.name}
              </h1>
            </div>
          </div>

          <div className="p-5">
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <Link href={`/games/${appId}/roadmap`} className={buttonClasses("primary", "sm")}>
                Ver roadmap de conquistas
                <span aria-hidden>→</span>
              </Link>
              {avgPendingDifficulty && (
                <span className="text-xs text-zinc-500">
                  Dificuldade do que falta: <DifficultyPill level={avgPendingDifficulty} />
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <GameStat label="Horas jogadas" value={`${Math.round(userGame.playtimeMinutes / 60)}h`} />
              <GameStat label="Conquistas" value={userGame.achievementsUnlocked} />
              <GameStat
                label="Faltam"
                value={userGame.achievementsTotal - userGame.achievementsUnlocked}
              />
              <GameStat label="Conclusão" value={`${percent.toFixed(0)}%`} />
            </div>
            {userGame.lastPlayedAt && (
              <p className="text-xs text-zinc-500 mt-3">
                Último acesso em {userGame.lastPlayedAt.toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Conquistas pendentes</h2>
          <Badge tone="neutral">{pendingAchievements.length}</Badge>
          <span className="text-xs text-zinc-500">ordenadas por dificuldade</span>
        </div>
        {pendingAchievements.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center mb-10">
            <p className="text-emerald-300">Todas as conquistas já foram obtidas. 🎉</p>
          </div>
        ) : (
          <div className="grid gap-2.5 mb-10">
            {pendingAchievements.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} unlocked={false} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <h2 className="font-display text-lg font-semibold tracking-tight">Conquistas obtidas</h2>
          <Badge tone="success">{unlockedAchievements.length}</Badge>
        </div>
        {unlockedAchievements.length === 0 ? (
          <p className="text-zinc-500 text-sm">Nenhuma conquista obtida ainda.</p>
        ) : (
          <div className="grid gap-2.5">
            {unlockedAchievements.map((achievement) => (
              <AchievementRow key={achievement.id} achievement={achievement} unlocked />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3">
      <p className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</p>
      <p className="tnum text-xl font-bold mt-0.5">{value}</p>
    </div>
  );
}

function AchievementRow({
  achievement,
  unlocked,
}: {
  achievement: {
    id: string;
    displayName: string;
    description: string | null;
    iconUrl: string | null;
    iconGrayUrl: string | null;
    globalPercent: number | null;
  };
  unlocked: boolean;
}) {
  const difficulty = estimateDifficulty(achievement.globalPercent);
  const rare = achievement.globalPercent != null && achievement.globalPercent < 5;

  return (
    <div
      className={`flex items-start gap-4 rounded-xl border p-3.5 transition-colors ${
        unlocked
          ? "border-emerald-500/20 bg-emerald-500/[0.04]"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <Image
        src={(unlocked ? achievement.iconUrl : achievement.iconGrayUrl) ?? ""}
        alt=""
        width={48}
        height={48}
        className={`rounded-lg ring-1 ring-white/10 shrink-0 ${unlocked ? "" : "opacity-70"}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium">{achievement.displayName}</p>
          {rare && <Badge tone="gold">Rara</Badge>}
        </div>
        {achievement.description && (
          <p className="text-sm text-zinc-500 mt-0.5">{achievement.description}</p>
        )}
        {!unlocked && <AchievementGuide achievementId={achievement.id} />}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
        {unlocked ? (
          <Badge tone="success">✓ Obtida</Badge>
        ) : (
          <DifficultyPill level={difficulty.level} />
        )}
        {achievement.globalPercent != null && (
          <p className="tnum text-xs text-zinc-500">{achievement.globalPercent.toFixed(1)}% têm</p>
        )}
      </div>
    </div>
  );
}
