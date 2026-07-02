"use client";

import { useEffect, useState } from "react";
import AchievementModal from "@/components/achievement-modal";
import { buttonClasses } from "@/components/ui/button";

type Stage = {
  title: string;
  body: string;
  achievementIds: string[];
};

type AchievementInfo = {
  id: string;
  displayName: string;
  iconUrl: string | null;
  unlocked: boolean;
};

export default function RoadmapView({
  appId,
  achievementsById,
}: {
  appId: string;
  achievementsById: Record<string, AchievementInfo>;
}) {
  const [stages, setStages] = useState<Stage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAchievementId, setSelectedAchievementId] = useState<string | null>(null);

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${appId}/roadmap${refresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar roadmap");
      setStages(data.roadmap.stages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar roadmap");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-semibold uppercase tracking-wider px-3 py-1">
          ✦ Roadmap
        </span>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className={buttonClasses("ghost", "sm")}
        >
          {loading ? "Gerando..." : "Regerar roadmap"}
        </button>
      </div>

      {loading && !stages && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin mb-3" />
          <p className="text-zinc-400 text-sm">
            Gerando roadmap com IA a partir das conquistas do jogo, isso pode levar alguns
            segundos...
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm">
          {error}
          {error.includes("GEMINI_API_KEY") &&
            " — configure a chave do Google Gemini no .env do servidor."}
        </p>
      )}

      {stages && (
        <ol className="relative border-l border-white/10 ml-3 space-y-6">
          {stages.map((stage, i) => (
            <li key={i} className="relative pl-6">
              <span className="absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-emerald-950 tnum">
                {i + 1}
              </span>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <h3 className="font-display text-base font-semibold mb-2">{stage.title}</h3>
                <p className="text-zinc-300 text-sm leading-relaxed mb-3">{stage.body}</p>
                {stage.achievementIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {stage.achievementIds.map((id) => {
                      const achievement = achievementsById[id];
                      if (!achievement) return null;
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedAchievementId(id)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors cursor-pointer ${
                            achievement.unlocked
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                              : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                          }`}
                        >
                          {achievement.iconUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={achievement.iconUrl} alt="" className="w-4 h-4 rounded-sm" />
                          )}
                          {achievement.displayName}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {selectedAchievementId &&
        achievementsById[selectedAchievementId] &&
        (() => {
          const achievement = achievementsById[selectedAchievementId];
          return (
            <AchievementModal
              achievementId={selectedAchievementId}
              displayName={achievement.displayName}
              iconUrl={achievement.iconUrl}
              unlocked={achievement.unlocked}
              onClose={() => setSelectedAchievementId(null)}
            />
          );
        })()}
    </div>
  );
}
