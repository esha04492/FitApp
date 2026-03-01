"use client"
import { useMemo, useState } from "react"
import StatCard from "./StatCard"
import type { HistoryEntry } from "./types"

const RESET_PASSWORD = "0000"

export default function StatsView(props: {
  totalsSplit: { steps: number; others: number }
  day: number
  dayTotals: { pct: number }
  history: HistoryEntry[]
  stats: { totalDays: number; totalReps: number; streak: number; last7: HistoryEntry[] }
  historyByExercise: Record<string, number>
  onReset: () => void
}) {
  const { day, dayTotals, history, stats, historyByExercise, onReset, totalsSplit } = props

  const last = useMemo(() => {
    if (history.length === 0) return null
    return [...history].sort((a, b) => (a.date > b.date ? -1 : 1))[0]
  }, [history])

  const [resetPwd, setResetPwd] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)

  const doReset = async () => {
    if (resetPwd !== RESET_PASSWORD) {
      setResetError("Invalid password")
      return
    }
    setResetError(null)
    await onReset()
    setResetPwd("")
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">Statistics</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">Summary</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label="Days completed" value={String(stats.totalDays)} />
          <StatCard label="Total steps" value={totalsSplit.steps.toLocaleString("en-US")} />
          <StatCard label="Total reps" value={totalsSplit.others.toLocaleString("en-US")} />
          <StatCard label="Streak" value={String(stats.streak)} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur text-left">
          <div className="text-xs text-neutral-400">Now (Day {day})</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-2xl font-semibold tabular-nums">{dayTotals.pct}%</div>
            <div className="text-xs text-neutral-500">{last ? `Latest: ${last.date} (Day ${last.day})` : "No completed days yet"}</div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400 transition-all duration-300"
              style={{ width: `${dayTotals.pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">Last 7 days</div>
          <div className="mt-3 space-y-2">
            {stats.last7.length === 0 ? (
              <div className="text-sm text-neutral-400">Complete a day and your history will appear here.</div>
            ) : (
              stats.last7.map((h) => (
                <div
                  key={`${h.date}-${h.day}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold">Day {h.day}</div>
                    <div className="text-xs text-neutral-400">{h.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {h.totalDone.toLocaleString("en-US")}
                      <span className="text-neutral-500"> / {h.totalTarget.toLocaleString("en-US")}</span>
                    </div>
                    <div className="text-xs text-neutral-400 tabular-nums">
                      {h.totalTarget ? Math.round((h.totalDone / h.totalTarget) * 100) : 0}%
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">Reps by exercise</div>
          <div className="mt-3 space-y-2">
            {Object.keys(historyByExercise).length === 0 ? (
              <div className="text-sm text-neutral-400">No data yet. Complete at least one day.</div>
            ) : (
              Object.entries(historyByExercise)
                .sort((a, b) => b[1] - a[1])
                .map(([name, reps]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-sm font-semibold tabular-nums">{reps.toLocaleString("en-US")}</div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">Reset</div>
          <div className="mt-1 text-xs text-neutral-400">Protection from accidental taps. Password: 0000</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Password"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
            />
            <button
              type="button"
              onClick={doReset}
              className="h-11 w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/15"
            >
              Reset all
            </button>
          </div>

          {resetError ? <div className="mt-2 text-xs text-red-200">{resetError}</div> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">Support</div>
          <div className="mt-1 text-xs text-neutral-400">If something is broken or you have ideas, message:</div>
          <a
            href="https://t.me/esha04"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            Write in Telegram
          </a>
        </div>
      </div>
    </>
  )
}
