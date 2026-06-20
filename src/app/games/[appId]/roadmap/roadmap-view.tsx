"use client";

import { useEffect, useState } from "react";

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
        <div className="bg-blue-900 text-white text-xs font-bold uppercase tracking-wide px-4 py-2 rounded-t-md">
          Roadmap
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
        >
          {loading ? "Gerando..." : "Regerar roadmap"}
        </button>
      </div>

      {loading && !stages && (
        <p className="text-zinc-400">
          Gerando roadmap com IA a partir das conquistas do jogo, isso pode levar alguns
          segundos...
        </p>
      )}

      {error && (
        <p className="text-red-400">
          {error}
          {error.includes("GEMINI_API_KEY") &&
            " — configure a chave do Google Gemini no .env do servidor."}
        </p>
      )}

      {stages && (
        <div className="divide-y divide-zinc-800 border border-zinc-800 rounded-b-md overflow-hidden">
          {stages.map((stage, i) => (
            <div key={i} className="bg-zinc-900 p-5">
              <h3 className="text-lg font-semibold mb-2">{stage.title}</h3>
              <p className="text-zinc-300 leading-relaxed mb-3">{stage.body}</p>
              {stage.achievementIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stage.achievementIds.map((id) => {
                    const achievement = achievementsById[id];
                    if (!achievement) return null;
                    return (
                      <span
                        key={id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs ${
                          achievement.unlocked
                            ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                            : "border-zinc-700 bg-zinc-800 text-zinc-300"
                        }`}
                      >
                        {achievement.iconUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={achievement.iconUrl} alt="" className="w-4 h-4 rounded-sm" />
                        )}
                        {achievement.displayName}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
