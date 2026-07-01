import Image from "next/image";
import RadialProgress from "@/components/charts/radial-progress";
import MetricComparison, { type MetricMember } from "@/components/charts/metric-comparison";

export type MemberStats = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  gamesOwned: number;
  achievementsTotal: number;
  achievementsUnlocked: number;
  percent: number;
  totalPlaytimeMinutes: number;
  perfectGames: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

function toMetric(members: MemberStats[], pick: (m: MemberStats) => number): MetricMember[] {
  return members.map((m) => ({
    userId: m.userId,
    username: m.username,
    avatarUrl: m.avatarUrl,
    value: pick(m),
  }));
}

function leader(members: MemberStats[], pick: (m: MemberStats) => number): MemberStats {
  return [...members].sort((a, b) => pick(b) - pick(a))[0];
}

export default function FamilyComparison({
  members,
  currentUserId,
}: {
  members: MemberStats[];
  currentUserId: string;
}) {
  if (members.length === 0) return null;

  const ranked = [...members].sort((a, b) => b.percent - a.percent);
  const podium = ranked.slice(0, 3);

  const champions = [
    {
      icon: "🏆",
      label: "Maior conclusão",
      winner: leader(members, (m) => m.percent),
      value: (m: MemberStats) => `${m.percent.toFixed(1)}%`,
    },
    {
      icon: "⏱️",
      label: "Mais horas jogadas",
      winner: leader(members, (m) => m.totalPlaytimeMinutes),
      value: (m: MemberStats) => `${Math.round(m.totalPlaytimeMinutes / 60).toLocaleString("pt-BR")}h`,
    },
    {
      icon: "💯",
      label: "Mais jogos platinados",
      winner: leader(members, (m) => m.perfectGames),
      value: (m: MemberStats) => `${m.perfectGames}`,
    },
    {
      icon: "🎯",
      label: "Mais conquistas",
      winner: leader(members, (m) => m.achievementsUnlocked),
      value: (m: MemberStats) => m.achievementsUnlocked.toLocaleString("pt-BR"),
    },
  ];

  const hours = (v: number) => `${Math.round(v / 60).toLocaleString("pt-BR")}h`;
  const count = (v: number) => v.toLocaleString("pt-BR");

  return (
    <div className="space-y-8">
      {/* Podium / ranking */}
      <div className="grid gap-4 sm:grid-cols-3">
        {podium.map((m, index) => {
          const isMe = m.userId === currentUserId;
          return (
            <div
              key={m.userId}
              className={`rounded-2xl border p-5 flex flex-col items-center text-center ${
                index === 0
                  ? "border-amber-600/60 bg-gradient-to-b from-amber-950/40 to-zinc-900"
                  : isMe
                    ? "border-emerald-800 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-900"
              }`}
            >
              <div className="text-2xl mb-1">{MEDALS[index] ?? `#${index + 1}`}</div>
              {m.avatarUrl && (
                <Image
                  src={m.avatarUrl}
                  alt={m.username}
                  width={56}
                  height={56}
                  className="rounded-full mb-2 ring-2 ring-zinc-700"
                />
              )}
              <p className={`font-semibold text-sm mb-3 ${isMe ? "text-emerald-300" : ""}`}>
                {m.username}
              </p>
              <RadialProgress
                value={m.percent}
                size={84}
                stroke={8}
                colorClass={index === 0 ? "text-amber-400" : "text-emerald-400"}
              >
                <span className="text-base font-bold">{m.percent.toFixed(0)}%</span>
              </RadialProgress>
              <div className="grid grid-cols-3 gap-2 mt-4 w-full text-center">
                <div>
                  <p className="text-sm font-semibold">{Math.round(m.totalPlaytimeMinutes / 60)}h</p>
                  <p className="text-[10px] text-zinc-500">horas</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{m.perfectGames}</p>
                  <p className="text-[10px] text-zinc-500">platinas</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{m.gamesOwned}</p>
                  <p className="text-[10px] text-zinc-500">jogos</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Champion highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {champions.map((c) => (
          <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-400 mb-1">
              <span className="mr-1">{c.icon}</span>
              {c.label}
            </p>
            <div className="flex items-center gap-2">
              {c.winner.avatarUrl && (
                <Image
                  src={c.winner.avatarUrl}
                  alt={c.winner.username}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <div className="min-w-0">
                <p
                  className={`text-sm font-semibold truncate ${
                    c.winner.userId === currentUserId ? "text-emerald-300" : ""
                  }`}
                >
                  {c.winner.username}
                </p>
                <p className="text-xs text-amber-400">{c.value(c.winner)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Per-metric bar charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricComparison
          title="Conclusão média"
          icon="📊"
          members={toMetric(members, (m) => m.percent)}
          currentUserId={currentUserId}
          format={(v) => `${v.toFixed(1)}%`}
          leaderBarClass="bg-emerald-400"
        />
        <MetricComparison
          title="Horas jogadas"
          icon="⏱️"
          members={toMetric(members, (m) => m.totalPlaytimeMinutes)}
          currentUserId={currentUserId}
          format={hours}
          leaderBarClass="bg-sky-400"
        />
        <MetricComparison
          title="Conquistas desbloqueadas"
          icon="🎯"
          members={toMetric(members, (m) => m.achievementsUnlocked)}
          currentUserId={currentUserId}
          format={count}
          leaderBarClass="bg-violet-400"
        />
        <MetricComparison
          title="Jogos platinados (100%)"
          icon="💯"
          members={toMetric(members, (m) => m.perfectGames)}
          currentUserId={currentUserId}
          format={count}
          leaderBarClass="bg-amber-400"
        />
      </div>
    </div>
  );
}
