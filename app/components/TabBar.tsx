"use client"
import type { ReactNode } from "react"

export default function TabBar({
  tab,
  setTab,
}: {
  tab: "today" | "stats"
  setTab: (t: "today" | "stats") => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-2 gap-2 px-5 py-3">
        <TabBtn active={tab === "today"} onClick={() => setTab("today")}>
          Сегодня
        </TabBtn>
        <TabBtn active={tab === "stats"} onClick={() => setTab("stats")}>
          Статистика
        </TabBtn>
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`h-11 rounded-2xl px-4 text-sm font-semibold transition active:scale-[0.99] ${
        active
          ? "bg-white/10 text-neutral-100 border border-white/15"
          : "bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/8"
      }`}
    >
      {children}
    </button>
  )
}
