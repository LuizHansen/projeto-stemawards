import Image from "next/image";

export type MetricMember = {
  userId: string;
  username: string;
  avatarUrl: string | null;
  value: number;
};

export default function MetricComparison({
  title,
  icon,
  members,
  currentUserId,
  format,
  leaderBarClass = "bg-amber-400",
  barClass = "bg-zinc-600",
}: {
  title: string;
  icon: string;
  members: MetricMember[];
  currentUserId: string;
  format: (value: number) => string;
  leaderBarClass?: string;
  barClass?: string;
}) {
  const sorted = [...members].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((m) => m.value), 1);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-3">
        <span className="mr-1.5">{icon}</span>
        {title}
      </h3>
      <div className="space-y-3">
        {sorted.map((m, index) => {
          const isLeader = index === 0 && m.value > 0;
          const isMe = m.userId === currentUserId;
          const widthPercent = max > 0 ? (m.value / max) * 100 : 0;

          return (
            <div key={m.userId} className="flex items-center gap-3">
              <div className="flex items-center gap-2 w-28 shrink-0">
                {m.avatarUrl && (
                  <Image
                    src={m.avatarUrl}
                    alt={m.username}
                    width={22}
                    height={22}
                    className="rounded-full shrink-0"
                  />
                )}
                <span
                  className={`text-xs truncate ${isMe ? "text-emerald-300 font-semibold" : "text-zinc-300"}`}
                >
                  {isLeader && "👑 "}
                  {m.username}
                </span>
              </div>
              <div className="flex-1 h-5 bg-zinc-800/70 rounded-md overflow-hidden relative">
                <div
                  className={`h-full rounded-md transition-[width] duration-700 ${
                    isLeader ? leaderBarClass : barClass
                  }`}
                  style={{ width: `${Math.max(widthPercent, 2)}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-zinc-100 drop-shadow">
                  {format(m.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
