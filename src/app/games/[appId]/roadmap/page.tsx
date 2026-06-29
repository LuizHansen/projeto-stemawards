import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BackLink from "@/components/back-link";
import RoadmapView from "./roadmap-view";

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const user = await requireUser();
  const { appId } = await params;

  const game = await prisma.game.findUnique({
    where: { appId: Number(appId) },
    include: { achievements: true },
  });
  if (!game) notFound();

  const userGame = await prisma.userGame.findUnique({
    where: { userId_gameId: { userId: user.id, gameId: game.id } },
    include: { userAchievements: true },
  });
  if (!userGame) notFound();

  const unlockedIds = new Set(
    userGame.userAchievements.filter((ua) => ua.unlocked).map((ua) => ua.achievementId),
  );

  const achievementsById = Object.fromEntries(
    game.achievements.map((a) => [
      a.id,
      {
        id: a.id,
        displayName: a.displayName,
        iconUrl: unlockedIds.has(a.id) ? a.iconUrl : a.iconGrayUrl,
        unlocked: unlockedIds.has(a.id),
      },
    ]),
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <BackLink href={`/games/${appId}`} label={`Voltar para ${game.name}`} />
        <h1 className="text-2xl font-bold mb-6">{game.name} — Roadmap de Conquistas</h1>
        <RoadmapView appId={appId} achievementsById={achievementsById} />
      </div>
    </div>
  );
}
