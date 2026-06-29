export type Guide = {
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

export default function AchievementGuideContent({ guide }: { guide: Guide }) {
  return (
    <div className="space-y-2">
      {guide.missable && (
        <div className="rounded-md border border-amber-700 bg-amber-950/40 p-2">
          <p className="text-amber-400 font-medium text-xs">⚠ Conquista perdível</p>
          {guide.missableReason && (
            <p className="text-amber-200 text-xs mt-0.5">{guide.missableReason}</p>
          )}
        </div>
      )}

      {(guide.difficulty || guide.estimatedTime) && (
        <p className="text-zinc-400 text-xs">
          {guide.difficulty && <span className="text-amber-300">{guide.difficulty}</span>}
          {guide.difficulty && guide.estimatedTime && " · "}
          {guide.estimatedTime && (
            <>
              Tempo estimado: <span className="text-zinc-200">{guide.estimatedTime}</span>
            </>
          )}
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
  );
}
