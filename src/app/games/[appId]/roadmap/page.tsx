import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BackLink from "@/components/back-link";
import TopNav from "@/components/top-nav";
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
    <div className="min-h-screen text-zinc-100">
      <TopNav user={user} active="biblioteca" />
      <div className="max-w-4xl mx-auto px-6 py-8">
        <BackLink href={`/games/${appId}`} label={`Voltar para ${game.name}`} />
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">{game.name}</h1>
        <p className="text-zinc-500 text-sm mb-6">Roadmap de conquistas gerado por IA</p>
        <RoadmapView appId={appId} achievementsById={achievementsById} />
      </div>
    </div>
  );
}
