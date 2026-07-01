"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

type Progress = { processed: number; total: number };

function formatEta(seconds: number): string {
  if (seconds <= 0) return "quase lá...";
  if (seconds < 60) return `~${Math.ceil(seconds)}s restantes`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `~${minutes}m ${rest.toString().padStart(2, "0")}s restantes`;
}

/**
 * The sync endpoint can occasionally return a non-JSON body (e.g. a Vercel
 * timeout/error page). Read as text first so we surface a friendly message
 * instead of crashing on `res.json()`.
 */
async function parseSyncResponse(res: Response): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const text = await res.text();
  try {
    return { ok: res.ok, data: JSON.parse(text) };
  } catch {
    throw new Error(
      res.status === 504 || /timeout|timed out/i.test(text)
        ? "A sincronização demorou demais e foi interrompida. Tente novamente — o progresso é salvo aos poucos."
        : "O servidor retornou uma resposta inesperada. Tente novamente em instantes.",
    );
  }
}

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<number>(0);

  function updateProgress(processed: number, total: number) {
    setProgress({ processed, total });
    // Estimate remaining time from the average rate so far. Only meaningful
    // once at least one batch has been processed.
    const elapsedMs = Date.now() - startedAtRef.current;
    if (processed > 0 && processed < total && elapsedMs > 0) {
      const msPerGame = elapsedMs / processed;
      setEtaSeconds(((total - processed) * msPerGame) / 1000);
    } else {
      setEtaSeconds(null);
    }
  }

  async function handleSync() {
    setLoading(true);
    setError(null);
    setProgress(null);
    setEtaSeconds(null);
    startedAtRef.current = Date.now();

    try {
      // Kick off a fresh sync (builds the queue + processes the first batch).
      let res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: true }),
      });
      let { ok, data } = await parseSyncResponse(res);
      if (!ok) throw new Error((data.error as string) ?? "Falha ao sincronizar");
      updateProgress(Number(data.processed) || 0, Number(data.total) || 0);

      // Drive the remaining batches until the queue is empty.
      let guard = 0;
      while (!data.done && guard++ < 1000) {
        res = await fetch("/api/sync", { method: "POST" });
        ({ ok, data } = await parseSyncResponse(res));
        if (!ok) throw new Error((data.error as string) ?? "Falha ao sincronizar");
        updateProgress(Number(data.processed) || 0, Number(data.total) || 0);
      }

      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar");
    } finally {
      setLoading(false);
    }
  }

  const percent =
    progress && progress.total > 0
      ? Math.min(100, (progress.processed / progress.total) * 100)
      : null;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={loading}
        className="rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
      >
        {loading ? "Sincronizando..." : "Atualizar Progresso"}
      </button>

      {loading && (
        <div className="w-60">
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={
                percent != null
                  ? "h-full bg-emerald-500 transition-all"
                  : "h-full bg-emerald-500 animate-pulse w-1/3"
              }
              style={percent != null ? { width: `${percent}%` } : undefined}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-zinc-500">
              {etaSeconds != null ? formatEta(etaSeconds) : ""}
            </p>
            <p className="text-xs text-zinc-400 text-right">
              {percent != null && progress
                ? `${progress.processed}/${progress.total} jogos (${percent.toFixed(0)}%)`
                : "Buscando biblioteca Steam..."}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-400 max-w-48 text-right">{error}</p>}
    </div>
  );
}
