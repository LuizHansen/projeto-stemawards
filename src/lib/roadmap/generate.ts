import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { estimateDifficulty } from "@/lib/guides/difficulty";
import { findAchievementExcerpt } from "@/lib/guides/fandom";

export type RoadmapStage = {
  title: string;
  body: string;
  achievementIds: string[];
};

type AchievementContext = {
  id: string;
  displayName: string;
  description: string | null;
  difficulty: string;
  globalPercent: number | null;
  wikiNote: string | null;
};

async function collectAchievementContext(gameId: string): Promise<AchievementContext[]> {
  const achievements = await prisma.achievement.findMany({
    where: { gameId },
    orderBy: { displayName: "asc" },
    include: { game: true },
  });

  // Only fetch wiki excerpts for the achievements that actually need extra
  // explanation (low unlock %) - cheap/common achievements rarely have
  // dedicated wiki coverage and it would just slow down generation.
  const hardEnoughForLookup = achievements
    .filter((a) => (a.globalPercent ?? 100) < 20)
    .slice(0, 15);

  const wikiNotes = new Map<string, string>();
  await Promise.all(
    hardEnoughForLookup.map(async (achievement) => {
      const result = await findAchievementExcerpt(
        achievement.game.name,
        achievement.displayName,
        achievement.description,
      );
      if (result) wikiNotes.set(achievement.id, result.excerpt);
    }),
  );

  return achievements.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    description: a.description,
    difficulty: estimateDifficulty(a.globalPercent).level,
    globalPercent: a.globalPercent,
    wikiNote: wikiNotes.get(a.id) ?? null,
  }));
}

function buildPrompt(gameName: string, achievements: AchievementContext[]): string {
  const list = achievements
    .map((a) => {
      const parts = [
        `- "${a.displayName}"`,
        a.description ? `Descrição: ${a.description}` : null,
        `Dificuldade estimada: ${a.difficulty}`,
        a.globalPercent != null ? `${a.globalPercent.toFixed(1)}% dos jogadores possuem` : null,
        a.wikiNote ? `Nota da wiki: ${a.wikiNote}` : null,
      ].filter(Boolean);
      return parts.join(" | ");
    })
    .join("\n");

  return `Você é um especialista em conquistas Steam, no estilo de roadmaps do PSNProfiles/TrueAchievements.

Jogo: ${gameName}

Lista de conquistas (com dificuldade estimada pelo percentual global de jogadores):
${list}

Monte um roadmap em etapas (estilo "Stage 1, Stage 2, ...") para o jogador conseguir 100% das conquistas com o mínimo de retrabalho, agrupando conquistas relacionadas (ex: história principal, colecionáveis, multiplayer/grind, dificuldades, missables). Cada etapa deve ter um texto corrido (2 a 5 frases) explicando o que fazer e por quê, no mesmo tom de um guia de roadmap de conquistas — direto, prático, mencionando conquistas relevantes pelo nome.

Responda APENAS com um JSON válido neste formato, sem markdown, sem texto fora do JSON:
{"stages": [{"title": "Stage 1: ...", "body": "...", "achievementNames": ["Nome exato da conquista 1", "Nome exato da conquista 2"]}]}

Use os nomes EXATOS das conquistas listadas acima em "achievementNames". Cada conquista deve aparecer em pelo menos uma etapa.`;
}

function parseRoadmapResponse(
  raw: string,
  achievements: AchievementContext[],
): RoadmapStage[] {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI response did not contain JSON");

  const parsed = JSON.parse(jsonMatch[0]) as {
    stages: { title: string; body: string; achievementNames: string[] }[];
  };

  const idByName = new Map(achievements.map((a) => [a.displayName.toLowerCase(), a.id]));

  return parsed.stages.map((stage) => ({
    title: stage.title,
    body: stage.body,
    achievementIds: stage.achievementNames
      .map((name) => idByName.get(name.toLowerCase()))
      .filter((id): id is string => Boolean(id)),
  }));
}

export async function getOrCreateGameRoadmap(gameId: string, forceRegenerate = false) {
  if (!forceRegenerate) {
    const existing = await prisma.gameRoadmap.findUnique({ where: { gameId } });
    if (existing) return existing;
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error("Game not found");

  const achievements = await collectAchievementContext(gameId);
  if (achievements.length === 0) throw new Error("Game has no achievements to build a roadmap from");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenAI({ apiKey });
  const response = await genAI.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildPrompt(game.name, achievements),
    config: { responseMimeType: "application/json" },
  });

  const text = response.text;
  if (!text) throw new Error("AI returned no text content");

  const stages = parseRoadmapResponse(text, achievements);

  const roadmap = await prisma.gameRoadmap.upsert({
    where: { gameId },
    create: { gameId, stages },
    update: { stages },
  });

  return roadmap;
}
