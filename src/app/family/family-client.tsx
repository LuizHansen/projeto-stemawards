"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GameImage from "@/components/game-image";
import FamilyComparison, { type MemberStats } from "./family-comparison";

type Owner = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  achievementsUnlocked: number;
  achievementsTotal: number;
};

type FamilyGame = {
  gameId: string;
  appId: number;
  name: string;
  headerUrl: string | null;
  owners: Owner[];
};

type Overview = {
  familyGroup: { id: string; name: string; inviteCode: string };
  members: { userId: string; username: string; avatarUrl: string | null }[];
  memberStats: MemberStats[];
  games: FamilyGame[];
};

export default function FamilyClient({ currentUserId }: { currentUserId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/family");
      const data = await res.json();
      setOverview(data.overview);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar grupo");
    } finally {
      setSubmitting(false);
    }
  }

  async function joinGroup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/family/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao entrar no grupo");
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveGroup() {
    setSubmitting(true);
    try {
      await fetch("/api/family", { method: "DELETE" });
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-zinc-400">Carregando...</p>;

  if (!overview) {
    return (
      <div className="max-w-md space-y-8">
        <form onSubmit={createGroup} className="space-y-3">
          <h2 className="text-lg font-semibold">Criar grupo familiar</h2>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nome do grupo (ex: Família Hansen)"
            className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            Criar grupo
          </button>
        </form>

        <form onSubmit={joinGroup} className="space-y-3">
          <h2 className="text-lg font-semibold">Entrar em um grupo existente</h2>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Código de convite"
            className="w-full rounded-md bg-zinc-900 border border-zinc-700 px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            Entrar
          </button>
        </form>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">{overview.familyGroup.name}</h2>
          <p className="text-sm text-zinc-400">
            Código de convite: <span className="font-mono text-zinc-200">{overview.familyGroup.inviteCode}</span>
          </p>
        </div>
        <button
          onClick={leaveGroup}
          disabled={submitting}
          className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
        >
          Sair do grupo
        </button>
      </div>

      <h2 id="comparacao" className="text-lg font-semibold mb-4 scroll-mt-8">
        Comparação entre membros
      </h2>
      <div className="mb-10">
        <FamilyComparison members={overview.memberStats} currentUserId={currentUserId} />
      </div>

      <h2 className="text-lg font-semibold mb-4">
        Biblioteca combinada ({overview.games.length} jogos)
      </h2>
      <div className="grid gap-3">
        {overview.games.map((game) => {
          const ownedByMe = game.owners.some((o) => o.userId === currentUserId);
          const content = (
            <>
              <GameImage appId={game.appId} name={game.name} className="w-28 h-14 object-cover rounded shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{game.name}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {game.owners.map((owner) => {
                    const percent =
                      owner.achievementsTotal > 0
                        ? (owner.achievementsUnlocked / owner.achievementsTotal) * 100
                        : 0;
                    return (
                      <span
                        key={owner.userId}
                        className={`text-xs rounded-full px-2 py-0.5 ${
                          owner.userId === currentUserId
                            ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800"
                            : "bg-zinc-800 text-zinc-300 border border-zinc-700"
                        }`}
                      >
                        {owner.username}: {percent.toFixed(0)}%
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          );

          if (!ownedByMe) {
            return (
              <div
                key={game.gameId}
                className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3 opacity-80"
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={game.gameId}
              href={`/games/${game.appId}`}
              className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-600 p-3"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
