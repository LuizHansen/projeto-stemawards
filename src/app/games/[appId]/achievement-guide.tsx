"use client";

import { useState } from "react";
import AchievementGuideContent, { type Guide } from "@/components/achievement-guide-content";

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
        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {open ? "Ocultar guia" : "Ver guia de conquista"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg bg-black/30 border border-white/10 p-3.5 text-sm">
          {loading && (
            <p className="text-zinc-400 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-emerald-400/40 border-t-emerald-400 animate-spin" />
              Gerando guia com IA...
            </p>
          )}
          {error && <p className="text-red-400">Não foi possível carregar o guia.</p>}
          {guide && <AchievementGuideContent guide={guide} />}
        </div>
      )}
    </div>
  );
}
