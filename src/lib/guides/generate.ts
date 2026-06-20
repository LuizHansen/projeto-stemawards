import { GoogleGenAI } from "@google/genai";
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

function buildPrompt(
  gameName: string,
  achievementName: string,
  description: string | null,
  difficultyLevel: string,
  globalPercent: number | null,
  wikiNote: string | null,
) {
  const context = [
    `Jogo: ${gameName}`,
    `Conquista: ${achievementName}`,
    description ? `Descrição oficial: ${description}` : null,
    `Dificuldade estimada: ${difficultyLevel}`,
    globalPercent != null ? `${globalPercent.toFixed(1)}% dos jogadores possuem esta conquista` : null,
    wikiNote ? `Trecho relevante encontrado em wiki do jogo: "${wikiNote}"` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Você é um especialista em conquistas/troféus Steam, no estilo de guias do PSNProfiles/TrueAchievements.

${context}

Escreva um guia específico para destravar esta conquista, como se fosse uma etapa de um roadmap focada só nela. Seja prático e direto, com passo a passo concreto (não repita só a descrição oficial - explique COMO fazer). Se você não tiver certeza de detalhes específicos do jogo, baseie-se em padrões comuns de jogos similares e seja honesto sobre a incerteza.

Avalie também se esta conquista é "perdível" (missable) - ou seja, se existe uma janela específica no jogo (uma decisão, um capítulo, um ponto sem volta) depois da qual não é mais possível obtê-la na mesma campanha/save, exigindo recomeçar ou um novo save para conseguir.

Responda APENAS com um JSON válido, sem markdown, sem texto fora do JSON, neste formato:
{
  "steps": "Passo a passo prático em texto corrido (3-6 frases)",
  "strategies": "Dicas e estratégias adicionais, ou null se não houver nada relevante além dos passos",
  "missable": true ou false,
  "missableReason": "Explicação de quando/por que é perdível, ou null se missable for false"
}`;
}

type AiGuideResponse = {
  steps: string;
  strategies: string | null;
  missable: boolean;
  missableReason: string | null;
};

async function generateWithAi(
  gameName: string,
  achievementName: string,
  description: string | null,
  difficultyLevel: string,
  globalPercent: number | null,
  wikiNote: string | null,
): Promise<AiGuideResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: buildPrompt(
        gameName,
        achievementName,
        description,
        difficultyLevel,
        globalPercent,
        wikiNote,
      ),
      config: { responseMimeType: "application/json" },
    });

    const text = response.text;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]) as AiGuideResponse;
  } catch (error) {
    console.error("AI guide generation failed", error);
    return null;
  }
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
  const sources = buildSearchSources(achievement.game.name, achievement.displayName);

  const wikiResult = await findAchievementExcerpt(
    achievement.game.name,
    achievement.displayName,
    achievement.description,
  );
  if (wikiResult) sources.unshift(wikiResult.pageUrl);

  const aiGuide = await generateWithAi(
    achievement.game.name,
    achievement.displayName,
    achievement.description,
    difficulty.level,
    achievement.globalPercent,
    wikiResult?.excerpt ?? null,
  );

  const guide = await prisma.achievementGuide.create({
    data: {
      achievementId,
      summary: achievement.description ?? "Sem descrição oficial disponível.",
      objective: achievement.description,
      steps:
        aiGuide?.steps ??
        wikiResult?.excerpt ??
        "Nenhum guia detalhado encontrado automaticamente para esta conquista ainda.",
      strategies: aiGuide?.strategies ?? null,
      difficulty: difficulty.level,
      estimatedTime: difficulty.estimatedTime,
      missable: aiGuide?.missable ?? null,
      missableReason: aiGuide?.missable ? aiGuide.missableReason : null,
      sources,
    },
  });

  return guide;
}
