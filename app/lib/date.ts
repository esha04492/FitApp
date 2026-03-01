import type { HistoryEntry } from "../components/types"

export function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(val, max))
}

export function localISODate() {
  return new Date().toLocaleDateString("sv-SE") // YYYY-MM-DD
}

export function parseLocalDate(d: string) {
  return new Date(`${d}T00:00:00`)
}

export function diffDays(a: string, b: string) {
  const da = parseLocalDate(a).getTime()
  const db = parseLocalDate(b).getTime()
  return Math.round((da - db) / (1000 * 60 * 60 * 24))
}

export function computeStreaks(history: HistoryEntry[]) {
  if (history.length === 0) return { current: 0, best: 0 }

  const sorted = [...history].sort((a, b) => a.day - b.day)

  let best = 0
  let current = 0
  for (const entry of sorted) {
    const isCompletedDay = entry.totalTarget > 0 && entry.totalDone >= entry.totalTarget
    if (isCompletedDay) {
      current += 1
      best = Math.max(best, current)
    } else {
      current = 0
    }
  }

  return { current, best }
}