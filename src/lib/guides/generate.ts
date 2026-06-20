import { prisma } from "@/lib/prisma";
import { estimateDifficulty } from "@/lib/guides/difficulty";
import { findAchievementExcerpt } from "@/lib/guides/fandom";

function buildSearchSources(gameName: string, achievementName: string) {
  const q = encodeURIComponent(`${gameName} ${achievementName} achievement guide`);
  return [
    `https://truetrophies.com/search?term=${encodeURIComponent(gameName)}`,
    `https://www.google.com/search?q=site:steamcommunity.com+guide+${q}`,
    `https://gamefaqs.gamespot.com/search?game=${encodeURIComponent(gameName)}`,
    `https://www.youtube.com/results?search_query=${q}`,
  ];
}

export async function getOrCreateAchievementGuide(achievementId: string) {
  const existing = await prisma.achievementGuide.findUnique({ where: { achievementId } });
  if (existing) return existing;

  const achievement = await prisma.achievement.findUnique({
    where: { id: achievementId },
    include: { game: true },
  });
  if (!achievement) throw new Error("Achievement not found");

  const difficulty = estimateDifficulty(achievement.globalPercent);

  const summary = achievement.description ?? "Sem descrição oficial disponível.";
  let steps = "Nenhum guia detalhado encontrado automaticamente para esta conquista ainda.";
  const sources = buildSearchSources(achievement.game.name, achievement.displayName);

  const result = await findAchievementExcerpt(
    achievement.game.name,
    achievement.displayName,
    achievement.description,
  );
  if (result) {
    const isRedundant =
      achievement.description &&
      result.excerpt.toLowerCase().includes(achievement.description.toLowerCase());
    steps = isRedundant
      ? "A wiki do jogo não detalha esta conquista além da descrição oficial acima."
      : result.excerpt;
    sources.unshift(result.pageUrl);
  }

  const guide = await prisma.achievementGuide.create({
    data: {
      achievementId,
      summary,
      objective: achievement.description,
      steps,
      difficulty: difficulty.level,
      estimatedTime: difficulty.estimatedTime,
      sources,
    },
  });

  return guide;
}
