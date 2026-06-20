"use client";

import { useState } from "react";

type Guide = {
  summary: string | null;
  objective: string | null;
  steps: string | null;
  difficulty: string | null;
  estimatedTime: string | null;
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
          {loading && <p className="text-zinc-400">Buscando guia...</p>}
          {error && <p className="text-red-400">Não foi possível carregar o guia.</p>}
          {guide && (
            <div className="space-y-2">
              {guide.estimatedTime && (
                <p className="text-zinc-400 text-xs">
                  Tempo estimado: <span className="text-zinc-200">{guide.estimatedTime}</span>
                </p>
              )}
              {guide.summary && <p>{guide.summary}</p>}
              {guide.steps && <p className="text-zinc-300">{guide.steps}</p>}
              {guide.sources.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-zinc-500 mb-1">Fontes:</p>
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
