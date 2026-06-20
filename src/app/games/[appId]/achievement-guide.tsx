"use client";

import { useState } from "react";

type Guide = {
  summary: string | null;
  objective: string | null;
  steps: string | null;
  strategies: string | null;
  difficulty: string | null;
  estimatedTime: string | null;
  missable: boolean | null;
  missableReason: string | null;
  sources: string[];
};

export default function AchievementGuide({ achievementId }: { achievementId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState(false);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (guide) return;

    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/achievements/${achievementId}/guide`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setGuide(data.guide);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        className="text-xs text-emerald-400 hover:text-emerald-300 underline"
      >
        {open ? "Ocultar guia" : "Ver guia"}
      </button>

      {open && (
        <div className="mt-2 rounded-md bg-zinc-950 border border-zinc-800 p-3 text-sm">
          {loading && <p className="text-zinc-400">Gerando guia com IA...</p>}
          {error && <p className="text-red-400">Não foi possível carregar o guia.</p>}
          {guide && (
            <div className="space-y-2">
              {guide.missable && (
                <div className="rounded-md border border-amber-700 bg-amber-950/40 p-2">
                  <p className="text-amber-400 font-medium text-xs">⚠ Conquista perdível</p>
                  {guide.missableReason && (
                    <p className="text-amber-200 text-xs mt-0.5">{guide.missableReason}</p>
                  )}
                </div>
              )}

              {guide.estimatedTime && (
                <p className="text-zinc-400 text-xs">
                  Tempo estimado: <span className="text-zinc-200">{guide.estimatedTime}</span>
                </p>
              )}

              {guide.steps && (
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Como conseguir:</p>
                  <p className="text-zinc-200">{guide.steps}</p>
                </div>
              )}

              {guide.strategies && (
                <div>
                  <p className="text-zinc-500 text-xs mb-0.5">Estratégias e dicas:</p>
                  <p className="text-zinc-300">{guide.strategies}</p>
                </div>
              )}

              {guide.sources.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-zinc-500 mb-1">Fontes consultadas:</p>
                  <ul className="space-y-1">
                    {guide.sources.map((src) => (
                      <li key={src}>
                        <a
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline break-all"
                        >
                          {src}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
