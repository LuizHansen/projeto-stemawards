"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type SyncStatus = {
  syncStartedAt: string | null;
  syncTotal: number | null;
  syncProcessed: number | null;
  syncError: string | null;
};

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sync/status");
        const data = await res.json();
        setStatus(data.status);
      } catch {
        // ignore transient polling errors
      }
    }, 1500);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setStatus(null);
    startPolling();
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao sincronizar");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao sincronizar");
    } finally {
      stopPolling();
      setLoading(false);
    }
  }

  const total = status?.syncTotal ?? null;
  const processed = status?.syncProcessed ?? null;
  const percent = total && total > 0 ? Math.min(100, ((processed ?? 0) / total) * 100) : null;

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
            {percent != null
              ? `${processed}/${total} jogos (${percent.toFixed(0)}%)`
              : "Buscando biblioteca Steam..."}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
