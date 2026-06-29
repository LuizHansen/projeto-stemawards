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
        className="text-xs text-emerald-400 hover:text-emerald-300 underline"
      >
        {open ? "Ocultar guia" : "Ver guia"}
      </button>

      {open && (
        <div className="mt-2 rounded-md bg-zinc-950 border border-zinc-800 p-3 text-sm">
          {loading && <p className="text-zinc-400">Gerando guia com IA...</p>}
          {error && <p className="text-red-400">Não foi possível carregar o guia.</p>}
          {guide && <AchievementGuideContent guide={guide} />}
        </div>
      )}
    </div>
  );
}
