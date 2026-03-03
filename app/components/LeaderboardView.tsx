"use client"
import { useState } from "react"

type LeaderboardRow = {
  rank: number
  userId: string
  label: string
  totalStars: number
}

export default function LeaderboardView(props: {
  myTotalStars: number
  rows: LeaderboardRow[]
  loading: boolean
  error: string | null
  showNameForm: boolean
  displayName: string
  displayNameSaving: boolean
  displayNameError: string | null
  onDisplayNameChange: (value: string) => void
  onSaveDisplayName: () => Promise<void>
  labels?: {
    leaderboard: string
    totalStarTitle: string
    chooseName: string
    save: string
    global: string
    loading: string
    noData: string
    howItWorks: string
    howItWorksTitle: string
    howItWorksBody: string
    ok: string
    examplesTitle: string
  }
  examples?: string[]
}) {
  const {
    myTotalStars,
    rows,
    loading,
    error,
    showNameForm,
    displayName,
    displayNameSaving,
    displayNameError,
    onDisplayNameChange,
    onSaveDisplayName,
    labels,
    examples = [],
  } = props
  const [showHowItWorks, setShowHowItWorks] = useState(false)

  const l = labels ?? {
    leaderboard: "Leaderboard",
    totalStarTitle: "Total ★",
    chooseName: "Choose your leaderboard name",
    save: "Save",
    global: "Global leaderboard",
    loading: "Loading leaderboard...",
    noData: "No data yet.",
    howItWorks: "How it works?",
    howItWorksTitle: "How stars are calculated",
    howItWorksBody:
      "Stars are calculated with a unified rule. The app converts your completed amount into stars using exercise rate. For custom exercises the rate is based on your daily target.",
    ok: "OK",
    examplesTitle: "Examples",
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">{l.leaderboard}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">{l.totalStarTitle}</div>

        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 backdrop-blur text-left">
          <div className="text-xs text-amber-300/90">{l.totalStarTitle}</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-amber-200">{myTotalStars.toLocaleString("en-US")} ★</div>
        </div>
      </div>

      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowHowItWorks(true)}
          className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition hover:bg-white/10"
        >
          {l.howItWorks}
        </button>

        {showNameForm ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="text-sm font-semibold">{l.chooseName}</div>
            <div className="mt-3 flex gap-2">
              <input
                value={displayName}
                maxLength={20}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
              <button
                type="button"
                disabled={displayNameSaving}
                onClick={onSaveDisplayName}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition hover:bg-white/10 disabled:opacity-50"
              >
                {l.save}
              </button>
            </div>
            {displayNameError ? <div className="mt-2 text-xs text-red-200">{displayNameError}</div> : null}
          </div>
        ) : null}

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">{l.global}</div>
          <div className="mt-3 space-y-2">
            {loading ? <div className="text-sm text-neutral-400">{l.loading}</div> : null}
            {error ? <div className="text-xs text-red-200 break-words">{error}</div> : null}
            {!loading && !error && rows.length === 0 ? (
              <div className="text-sm text-neutral-400">{l.noData}</div>
            ) : null}
            {!loading && !error
              ? rows.map((row) => (
                  <div
                    key={row.userId}
                    className={`flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2 ${
                      row.rank <= 3 ? "py-3" : ""
                    }`}
                  >
                    <div
                      className={`tabular-nums ${
                        row.rank <= 3 ? "text-base font-bold" : "text-sm font-semibold"
                      } ${
                        row.rank === 1
                          ? "text-amber-300"
                          : row.rank === 2
                            ? "text-slate-300"
                            : row.rank === 3
                              ? "text-orange-300"
                              : ""
                      }`}
                    >
                      #{row.rank}
                    </div>
                    <div
                      className={`mx-3 flex-1 truncate ${
                        row.rank <= 3 ? "text-base font-bold" : "text-sm"
                      } ${
                        row.rank === 1
                          ? "text-amber-300"
                          : row.rank === 2
                            ? "text-slate-300"
                            : row.rank === 3
                              ? "text-orange-300"
                              : "text-neutral-200"
                      }`}
                    >
                      {row.label}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-amber-200">{row.totalStars.toLocaleString("en-US")} ★</div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>

      {showHowItWorks ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
            <div className="text-base font-semibold text-neutral-100">{l.howItWorksTitle}</div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-300">{l.howItWorksBody}</p>
            <div className="mt-3 text-sm font-semibold text-neutral-100">{l.examplesTitle}</div>
            <div className="mt-2 space-y-1 text-sm text-neutral-300">
              {examples.map((line, idx) => (
                <div key={idx}>{line}</div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHowItWorks(false)}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition hover:bg-white/10"
              >
                {l.ok}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
