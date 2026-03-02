"use client"

type LeaderboardRow = {
  rank: number
  userId: string
  label: string
  stars: number
}

export default function LeaderboardView(props: {
  myStars: number
  rows: LeaderboardRow[]
  loading: boolean
  error: string | null
}) {
  const { myStars, rows, loading, error } = props

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">Leaderboard</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">Stars</div>

        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 backdrop-blur text-left">
          <div className="text-xs text-amber-300/90">My stars</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-amber-200">{myStars.toFixed(1)}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">Global leaderboard</div>
          <div className="mt-3 space-y-2">
            {loading ? <div className="text-sm text-neutral-400">Loading leaderboard...</div> : null}
            {error ? <div className="text-xs text-red-200 break-words">{error}</div> : null}
            {!loading && !error && rows.length === 0 ? (
              <div className="text-sm text-neutral-400">No data yet.</div>
            ) : null}
            {!loading && !error
              ? rows.map((row) => (
                  <div
                    key={row.userId}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="text-sm font-semibold tabular-nums">#{row.rank}</div>
                    <div className="mx-3 flex-1 truncate text-sm text-neutral-200">{row.label}</div>
                    <div className="text-sm font-semibold tabular-nums text-amber-200">{row.stars.toFixed(1)}</div>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
    </>
  )
}

