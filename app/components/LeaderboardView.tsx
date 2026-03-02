"use client"

type LeaderboardRow = {
  rank: number
  userId: string
  label: string
  totalStars: number
  streakStars: number
}

export default function LeaderboardView(props: {
  myTotalStars: number
  myStreakStars: number
  rows: LeaderboardRow[]
  loading: boolean
  error: string | null
  showNameForm: boolean
  displayName: string
  displayNameSaving: boolean
  displayNameError: string | null
  onDisplayNameChange: (value: string) => void
  onSaveDisplayName: () => Promise<void>
}) {
  const {
    myTotalStars,
    myStreakStars,
    rows,
    loading,
    error,
    showNameForm,
    displayName,
    displayNameSaving,
    displayNameError,
    onDisplayNameChange,
    onSaveDisplayName,
  } = props

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">Leaderboard</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">Stars</div>

        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 backdrop-blur text-left">
          <div className="text-xs text-amber-300/90">Total stars</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-amber-200">{myTotalStars.toFixed(1)}</div>
          <div className="mt-1 text-xs text-amber-300/80">Streak stars: {myStreakStars.toFixed(1)}</div>
        </div>
      </div>

      <div className="space-y-4">
        {showNameForm ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="text-sm font-semibold">Choose your leaderboard name</div>
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
                Save
              </button>
            </div>
            {displayNameError ? <div className="mt-2 text-xs text-red-200">{displayNameError}</div> : null}
          </div>
        ) : null}

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
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums text-amber-200">{row.totalStars.toFixed(1)}</div>
                      <div className="text-[11px] text-neutral-400">Streak {row.streakStars.toFixed(1)}</div>
                    </div>
                  </div>
                ))
              : null}
          </div>
        </div>
      </div>
    </>
  )
}
