import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "info" | "warning" | "danger" | "gold";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-white/5 text-zinc-300 border-white/10",
  success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  info: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  warning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  danger: "bg-red-500/10 text-red-300 border-red-500/25",
  gold: "bg-amber-400/15 text-amber-300 border-amber-400/30",
};

export default function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
