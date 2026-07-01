"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Progress = { processed: number; total: number };

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
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Kick off a fresh sync (builds the queue + processes the first batch).
      let res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: true }),
      });
      let { ok, data } = await parseSyncResponse(res);
      if (!ok) throw new Error((data.error as string) ?? "Falha ao sincronizar");
      setProgress({ processed: Number(data.processed) || 0, total: Number(data.total) || 0 });

      // Drive the remaining batches until the queue is empty.
      let guard = 0;
      while (!data.done && guard++ < 1000) {
        res = await fetch("/api/sync", { method: "POST" });
        ({ ok, data } = await parseSyncResponse(res));
        if (!ok) throw new Error((data.error as string) ?? "Falha ao sincronizar");
        setProgress({ processed: Number(data.processed) || 0, total: Number(data.total) || 0 });
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
        <div className="w-48">
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
          <p className="text-xs text-zinc-400 mt-1 text-right">
            {percent != null && progress
              ? `${progress.processed}/${progress.total} jogos (${percent.toFixed(0)}%)`
              : "Buscando biblioteca Steam..."}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400 max-w-48 text-right">{error}</p>}
    </div>
  );
}
