"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import GameImage from "@/components/game-image";
import Badge from "@/components/ui/badge";

type Member = { userId: string; username: string; avatarUrl: string | null };

type Owner = {
  userId: string;
  username: string;
  achievementsUnlocked: number;
  achievementsTotal: number;
};

type LibGame = {
  gameId: string;
  appId: number;
  name: string;
  owners: Owner[];
};

const HIGHLIGHT_LIMIT = 12;

function ownerPercent(owner: Owner): number {
  return owner.achievementsTotal > 0
    ? (owner.achievementsUnlocked / owner.achievementsTotal) * 100
    : 0;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0];
}

function GameTile({
  game,
  currentUserId,
  footer,
}: {
  game: LibGame;
  currentUserId: string;
  footer: React.ReactNode;
}) {
  const ownedByMe = game.owners.some((o) => o.userId === currentUserId);

  const inner = (
    <div
      className={`rounded-lg overflow-hidden bg-white/[0.02] border border-white/10 transition-all duration-300 ease-out group-hover:scale-105 group-hover:z-20 group-hover:shadow-2xl ${
        ownedByMe ? "group-hover:border-white/25" : ""
      }`}
    >
      <div className="aspect-video w-full relative">
        <GameImage
          appId={game.appId}
          name={game.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <div className="px-3 py-2">
        <p className="text-sm font-semibold truncate">{game.name}</p>
        <div className="mt-0.5">{footer}</div>
      </div>
    </div>
  );

  if (ownedByMe) {
    return (
      <Link href={`/games/${game.appId}`} className="group relative block">
        {inner}
      </Link>
    );
  }
  return <div className="group relative block opacity-80">{inner}</div>;
}

function ProgressFooter({ percent }: { percent: number }) {
  return (
    <>
      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-400" style={{ width: `${percent}%` }} />
      </div>
      <p className="tnum text-xs text-zinc-400 mt-1">{percent.toFixed(0)}%</p>
    </>
  );
}

function OwnersFooter({ owners, currentUserId }: { owners: Owner[]; currentUserId: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {owners.map((owner) => (
        <span
          key={owner.userId}
          className={`text-[10px] rounded-full px-1.5 py-0.5 border ${
            owner.userId === currentUserId
              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
              : "bg-white/5 text-zinc-300 border-white/10"
          }`}
        >
          {firstName(owner.username)}: {ownerPercent(owner).toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

function MemberFilter({
  members,
  value,
  onChange,
  includeAll,
  allLabel = "Todos",
}: {
  members: Member[];
  value: string;
  onChange: (value: string) => void;
  includeAll: boolean;
  allLabel?: string;
}) {
  const options: { id: string; label: string; avatarUrl: string | null }[] = [
    ...(includeAll ? [{ id: "all", label: allLabel, avatarUrl: null }] : []),
    ...members.map((m) => ({ id: m.userId, label: firstName(m.username), avatarUrl: m.avatarUrl })),
  ];

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 py-1 text-xs transition-colors ${
              active
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                : "bg-white/[0.03] border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20"
            }`}
          >
            {opt.avatarUrl ? (
              <Image
                src={opt.avatarUrl}
                alt=""
                width={16}
                height={16}
                className="rounded-full"
              />
            ) : (
              <span className="h-4 w-4 rounded-full bg-white/10 grid place-items-center text-[9px]">
                ★
              </span>
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Segmented({
  value,
  onChange,
}: {
  value: "advanced" | "perfect";
  onChange: (v: "advanced" | "perfect") => void;
}) {
  return (
    <div className="inline-flex rounded-lg bg-white/[0.03] border border-white/10 p-0.5">
      {(
        [
          ["advanced", "Mais avançados"],
          ["perfect", "Platinados"],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === key ? "bg-emerald-500 text-emerald-950" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardLibrary({
  members,
  games,
  currentUserId,
  isFamily,
}: {
  members: Member[];
  games: LibGame[];
  currentUserId: string;
  isFamily: boolean;
}) {
  const [highlightMember, setHighlightMember] = useState<string>(currentUserId);
  const [highlightMode, setHighlightMode] = useState<"advanced" | "perfect">("advanced");
  const [libraryMember, setLibraryMember] = useState<string>("all");

  // Progress for a game from the chosen highlight subject: a specific member,
  // or the best any member reached when "Todos".
  function subjectProgress(game: LibGame): { percent: number; hasIt: boolean } {
    if (highlightMember === "all") {
      const best = Math.max(0, ...game.owners.map(ownerPercent));
      return { percent: best, hasIt: game.owners.length > 0 };
    }
    const owner = game.owners.find((o) => o.userId === highlightMember);
    return { percent: owner ? ownerPercent(owner) : 0, hasIt: Boolean(owner) };
  }

  const highlights = useMemo(() => {
    const scored = games
      .map((g) => ({ game: g, ...subjectProgress(g) }))
      .filter((x) => x.hasIt);

    const matching =
      highlightMode === "perfect"
        ? scored.filter((x) => x.percent >= 100)
        : scored.filter((x) => x.percent < 100);

    matching.sort((a, b) => b.percent - a.percent);
    return matching;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, highlightMember, highlightMode]);

  const library = useMemo(() => {
    if (libraryMember === "all") return games;
    return games.filter((g) => g.owners.some((o) => o.userId === libraryMember));
  }, [games, libraryMember]);

  const shownHighlights = highlights.slice(0, HIGHLIGHT_LIMIT);

  return (
    <>
      {/* Destaques */}
      <section className="mb-14">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-lg font-semibold tracking-tight">Destaques</h2>
            <Segmented value={highlightMode} onChange={setHighlightMode} />
            {highlights.length > 0 && <Badge tone="neutral">{highlights.length}</Badge>}
          </div>
          {isFamily && (
            <MemberFilter
              members={members}
              value={highlightMember}
              onChange={setHighlightMember}
              includeAll
              allLabel="Melhor"
            />
          )}
        </div>

        {shownHighlights.length === 0 ? (
          <p className="text-sm text-zinc-500">
            {highlightMode === "perfect"
              ? "Nenhum jogo 100% concluído ainda."
              : "Nenhum jogo em andamento por aqui."}
          </p>
        ) : (
          <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-10">
            {shownHighlights.map(({ game, percent }) => (
              <GameTile
                key={game.gameId}
                game={game}
                currentUserId={currentUserId}
                footer={<ProgressFooter percent={percent} />}
              />
            ))}
          </div>
        )}
      </section>

      {/* Biblioteca */}
      <section>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {isFamily ? "Biblioteca da família" : "Biblioteca"}
            </h2>
            <Badge tone="neutral">{library.length.toLocaleString("pt-BR")}</Badge>
          </div>
          {isFamily && (
            <MemberFilter
              members={members}
              value={libraryMember}
              onChange={setLibraryMember}
              includeAll
            />
          )}
        </div>

        <div className="grid [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] gap-x-4 gap-y-10">
          {library.map((game) => {
            const memberOwner =
              libraryMember === "all"
                ? null
                : game.owners.find((o) => o.userId === libraryMember);
            return (
              <GameTile
                key={game.gameId}
                game={game}
                currentUserId={currentUserId}
                footer={
                  memberOwner ? (
                    <ProgressFooter percent={ownerPercent(memberOwner)} />
                  ) : (
                    <OwnersFooter owners={game.owners} currentUserId={currentUserId} />
                  )
                }
              />
            );
          })}
        </div>
      </section>
    </>
  );
}
