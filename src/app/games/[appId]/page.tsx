import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateDifficulty, type DifficultyLevel } from "@/lib/guides/difficulty";
import GameImage from "@/components/game-image";
import AchievementGuide from "./achievement-guide";

const DIFFICULTY_ORDER: DifficultyLevel[] = [
  "Muito Fácil",
  "Fácil",
  "Médio",
  "Difícil",
  "Muito Difícil",
];

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden mb-8">
        <GameImage appId={game.appId} name={game.name} className="w-full max-h-64 object-cover" />
        <div className="p-5">
          <h1 className="text-2xl font-bold">{game.name}</h1>
          <Link
            href={`/games/${appId}/roadmap`}
            className="inline-block mt-1 text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Ver roadmap de conquistas →
          </Link>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <GameStat label="Horas jogadas" value={Math.round(userGame.playtimeMinutes / 60)} />
            <GameStat label="Conquistas obtidas" value={userGame.achievementsUnlocked} />
            <GameStat
              label="Conquistas restantes"
              value={userGame.achievementsTotal - userGame.achievementsUnlocked}
            />
            <GameStat label="Conclusão" value={`${percent.toFixed(1)}%`} />
            <GameStat
              label="Último acesso"
              value={
                userGame.lastPlayedAt
                  ? userGame.lastPlayedAt.toLocaleDateString("pt-BR")
                  : "—"
              }
            />
            <GameStat label="Dificuldade restante" value={avgPendingDifficulty ?? "—"} />
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4 mt-0">
        Conquistas pendentes (ordenadas por dificuldade)
      </h2>
      {pendingAchievements.length === 0 ? (
        <p className="text-zinc-400 mb-10">Todas as conquistas já foram obtidas. 🎉</p>
      ) : (
        <div className="grid gap-3 mb-10">
          {pendingAchievements.map((achievement) => (
            <AchievementRow key={achievement.id} achievement={achievement} unlocked={false} />
          ))}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-4">Conquistas obtidas</h2>
      {unlockedAchievements.length === 0 ? (
        <p className="text-zinc-400">Nenhuma conquista obtida ainda.</p>
      ) : (
        <div className="grid gap-3">
          {unlockedAchievements.map((achievement) => (
            <AchievementRow key={achievement.id} achievement={achievement} unlocked />
          ))}
        </div>
      )}
    </div>
  );
}

function GameStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-lg font-bold">{value}</p>
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

  return (
    <div
      className={`flex items-start gap-4 rounded-lg border p-3 ${
        unlocked ? "border-emerald-800 bg-emerald-950/30" : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <Image
        src={unlocked ? achievement.iconUrl ?? "" : achievement.iconGrayUrl ?? ""}
        alt={achievement.displayName}
        width={48}
        height={48}
        className="rounded"
      />
      <div className="flex-1">
        <p className="font-medium">{achievement.displayName}</p>
        {achievement.description && (
          <p className="text-sm text-zinc-400">{achievement.description}</p>
        )}
        {!unlocked && <AchievementGuide achievementId={achievement.id} />}
      </div>
      <div className="text-right text-sm shrink-0">
        {achievement.globalPercent != null && (
          <p className="text-zinc-400">{achievement.globalPercent.toFixed(1)}% dos jogadores</p>
        )}
        {!unlocked && <p className="text-amber-400">{difficulty.level}</p>}
        <p className={unlocked ? "text-emerald-400" : "text-zinc-500"}>
          {unlocked ? "Obtida" : "Não obtida"}
        </p>
      </div>
    </div>
  );
}
