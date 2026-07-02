import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5",
  md: "text-sm px-4 py-2",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-semibold shadow-sm shadow-emerald-500/25",
  secondary:
    "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 border border-white/10 hover:border-white/20",
  ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06]",
  danger: "text-red-400 hover:text-red-300 hover:bg-red-500/10",
};

export function buttonClasses(variant: ButtonVariant = "secondary", size: ButtonSize = "md") {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

export default function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button className={`${buttonClasses(variant, size)} ${className}`} {...props} />;
}
