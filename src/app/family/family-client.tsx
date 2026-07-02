"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import GameImage from "@/components/game-image";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import FamilyComparison, { type MemberStats } from "./family-comparison";

const inputClasses =
  "w-full rounded-lg bg-white/[0.03] border border-white/10 focus:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 px-3.5 py-2.5 text-sm placeholder:text-zinc-600 transition-colors";

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
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <form
          onSubmit={createGroup}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3"
        >
          <h2 className="font-display font-semibold">Criar grupo familiar</h2>
          <p className="text-xs text-zinc-500 -mt-1">Você recebe um código para convidar os outros.</p>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Nome do grupo (ex: Família Hansen)"
            className={inputClasses}
            required
          />
          <Button type="submit" variant="primary" disabled={submitting}>
            Criar grupo
          </Button>
        </form>

        <form
          onSubmit={joinGroup}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3"
        >
          <h2 className="font-display font-semibold">Entrar em um grupo</h2>
          <p className="text-xs text-zinc-500 -mt-1">Use o código que alguém da família compartilhou.</p>
          <input
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Código de convite"
            className={`${inputClasses} font-mono tracking-wider`}
            required
          />
          <Button type="submit" variant="secondary" disabled={submitting}>
            Entrar
          </Button>
        </form>

        {error && <p className="text-red-400 text-sm sm:col-span-2">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-8 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{overview.familyGroup.name}</h2>
          <p className="text-sm text-zinc-400 mt-0.5 flex items-center gap-1.5">
            Código de convite:
            <span className="font-mono tracking-wider text-zinc-100 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
              {overview.familyGroup.inviteCode}
            </span>
          </p>
        </div>
        <Button onClick={leaveGroup} variant="danger" size="sm" disabled={submitting}>
          Sair do grupo
        </Button>
      </div>

      <h2 id="comparacao" className="font-display text-lg font-semibold mb-4 scroll-mt-20">
        Comparação entre membros
      </h2>
      <div className="mb-10">
        <FamilyComparison members={overview.memberStats} currentUserId={currentUserId} />
      </div>

      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold">Biblioteca combinada</h2>
        <Badge tone="neutral">{overview.games.length}</Badge>
      </div>
      <div className="grid gap-2.5">
        {overview.games.map((game) => {
          const ownedByMe = game.owners.some((o) => o.userId === currentUserId);
          const content = (
            <>
              <GameImage
                appId={game.appId}
                name={game.name}
                className="w-28 h-14 object-cover rounded-lg ring-1 ring-white/10 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{game.name}</p>
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {game.owners.map((owner) => {
                    const percent =
                      owner.achievementsTotal > 0
                        ? (owner.achievementsUnlocked / owner.achievementsTotal) * 100
                        : 0;
                    return (
                      <span
                        key={owner.userId}
                        className={`text-xs rounded-full px-2 py-0.5 border ${
                          owner.userId === currentUserId
                            ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                            : "bg-white/5 text-zinc-300 border-white/10"
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
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-3 opacity-70"
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={game.gameId}
              href={`/games/${game.appId}`}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 p-3 transition-colors"
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
