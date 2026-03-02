"use client"
import type { ReactNode } from "react"

export default function TabBar({
  tab,
  setTab,
  labels,
}: {
  tab: "today" | "stats" | "leaderboard"
  setTab: (t: "today" | "stats" | "leaderboard") => void
  labels?: { today: string; stats: string; leaderboard: string }
}) {
  const l = labels ?? { today: "Today", stats: "Stats", leaderboard: "Leaderboard" }
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-neutral-950/70 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 px-5 py-3">
        <TabBtn active={tab === "today"} onClick={() => setTab("today")}>
          {l.today}
        </TabBtn>
        <TabBtn active={tab === "stats"} onClick={() => setTab("stats")}>
          {l.stats}
        </TabBtn>
        <TabBtn active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
          {l.leaderboard}
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
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center justify-center rounded-2xl px-4 text-center text-sm font-semibold transition active:scale-[0.99] ${
        active
          ? "bg-white/10 text-neutral-100 border border-white/15"
          : "bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/8"
      }`}
    >
      {children}
    </button>
  )
}
