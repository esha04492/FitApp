"use client"
import type { ReactNode } from "react"

export default function ActionBtn({
  children,
  onClick,
  variant,
}: {
  children: ReactNode
  onClick: () => void
  variant: "ghost" | "primary" | "primaryStrong"
}) {
  const base =
    "h-11 rounded-2xl px-3 text-sm font-semibold transition shadow-sm active:scale-[0.99] border"
  const styles =
    variant === "ghost"
      ? "border-white/10 bg-white/5 text-neutral-100 hover:bg-white/10"
      : variant === "primary"
      ? "border-white/10 bg-white/10 text-neutral-100 hover:bg-white/15"
      : "border-white/10 bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400 text-neutral-950 hover:opacity-95"

  return (
    <button onClick={onClick} className={`${base} ${styles}`}>
      {children}
    </button>
  )
}
