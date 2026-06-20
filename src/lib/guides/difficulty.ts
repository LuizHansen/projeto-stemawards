export type DifficultyLevel = "Muito Fácil" | "Fácil" | "Médio" | "Difícil" | "Muito Difícil";

export type DifficultyEstimate = {
  level: DifficultyLevel;
  score: number;
  estimatedTime: string;
};

/**
 * Steam doesn't expose a difficulty rating, so we derive one from the global
 * unlock percentage: achievements very few players have tend to require more
 * effort, skill, or grind (mirrors how TrueAchievements/PSNProfiles infer
 * trophy rarity -> difficulty).
 */
export function estimateDifficulty(globalPercent: number | null): DifficultyEstimate {
  const percent = globalPercent ?? 50;

  if (percent >= 50) {
    return { level: "Muito Fácil", score: 1, estimatedTime: "Menos de 30 minutos" };
  }
  if (percent >= 25) {
    return { level: "Fácil", score: 2, estimatedTime: "30 minutos a 2 horas" };
  }
  if (percent >= 10) {
    return { level: "Médio", score: 3, estimatedTime: "2 a 10 horas" };
  }
  if (percent >= 2) {
    return { level: "Difícil", score: 4, estimatedTime: "10 a 30 horas" };
  }
  return { level: "Muito Difícil", score: 5, estimatedTime: "30+ horas ou requer habilidade/sorte" };
}
