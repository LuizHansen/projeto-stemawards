"use client";

import { useEffect, useState } from "react";
import AchievementGuideContent, { type Guide } from "@/components/achievement-guide-content";

export default function AchievementModal({
  achievementId,
  displayName,
  iconUrl,
  unlocked,
  onClose,
}: {
  achievementId: string;
  displayName: string;
  iconUrl: string | null;
  unlocked: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/achievements/${achievementId}/guide`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGuide(data.guide);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [achievementId]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          {iconUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iconUrl} alt="" className="w-12 h-12 rounded shrink-0" />
          )}
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{displayName}</h3>
            <p className={`text-xs ${unlocked ? "text-emerald-400" : "text-zinc-500"}`}>
              {unlocked ? "Obtida" : "Não obtida"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xl leading-none"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {loading && <p className="text-zinc-400 text-sm">Gerando guia com IA...</p>}
        {error && <p className="text-red-400 text-sm">Não foi possível carregar o guia.</p>}
        {guide && <AchievementGuideContent guide={guide} />}
      </div>
    </div>
  );
}
