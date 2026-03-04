"use client"
import { useMemo, useState } from "react"
import StatCard from "./StatCard"
import type { HistoryEntry } from "./types"

const RESET_PASSWORD = "0000"

export default function StatsView(props: {
  lang?: "ru" | "en"
  totalsSplit: { steps: number; others: number }
  day: number
  dayTotals: { pct: number }
  history: HistoryEntry[]
  stats: { totalDays: number; totalReps: number; streak: number; last7: HistoryEntry[] }
  historyByExercise: Record<string, number>
  onReset: () => void
}) {
  const { day, dayTotals, history, stats, historyByExercise, onReset, totalsSplit, lang = "ru" } = props

  const trExerciseName = (name: string) => {
    if (lang !== "ru") return name
    const key = name.trim().toLowerCase()
    const map: Record<string, string> = {
      "push-ups": "Отжимания",
      pushups: "Отжимания",
      "pull-ups": "Подтягивания",
      pullups: "Подтягивания",
      squats: "Приседания",
      dips: "Отжимания на брусьях",
      abs: "Пресс",
      walking: "Ходьба",
      lunges: "Выпады",
      burpees: "Берпи",
      "jump rope": "Прыжки на скакалке",
      "mountain climbers": "Скалолаз",
    }
    return map[key] ?? name
  }

  const tx =
    lang === "ru"
      ? {
          title: "Статистика",
          summary: "Сводка",
          daysCompleted: "Завершено дней",
          totalSteps: "Всего шагов",
          totalReps: "Всего повторений",
          streak: "Серия",
          now: "Сейчас",
          latest: "Последний",
          noCompletedDays: "Пока нет завершенных дней",
          last7: "Последние 7 дней",
          historyEmpty: "Заверши день, и здесь появится история.",
          day: "День",
          repsByExercise: "Повторения по упражнениям",
          noData: "Пока нет данных. Заверши хотя бы один день.",
          reset: "Сброс",
          resetHint: "Защита от случайного нажатия. Пароль: 0000",
          password: "Пароль",
          resetAll: "Сбросить всё",
          invalidPassword: "Неверный пароль",
          support: "Поддержка",
          supportHint: "Если что-то сломалось или есть идеи, напиши:",
          supportBtn: "Написать в Telegram",
          supportProjectBtn: "Поддержать проект",
        }
      : {
          title: "Statistics",
          summary: "Summary",
          daysCompleted: "Days completed",
          totalSteps: "Total steps",
          totalReps: "Total reps",
          streak: "Streak",
          now: "Now",
          latest: "Latest",
          noCompletedDays: "No completed days yet",
          last7: "Last 7 days",
          historyEmpty: "Complete a day and your history will appear here.",
          day: "Day",
          repsByExercise: "Reps by exercise",
          noData: "No data yet. Complete at least one day.",
          reset: "Reset",
          resetHint: "Protection from accidental taps. Password: 0000",
          password: "Password",
          resetAll: "Reset all",
          invalidPassword: "Invalid password",
          support: "Support",
          supportHint: "If something is broken or you have ideas, message:",
          supportBtn: "Write in Telegram",
          supportProjectBtn: "Support the project",
        }

  const last = useMemo(() => {
    if (history.length === 0) return null
    return [...history].sort((a, b) => (a.date > b.date ? -1 : 1))[0]
  }, [history])

  const [resetPwd, setResetPwd] = useState("")
  const [resetError, setResetError] = useState<string | null>(null)

  const doReset = async () => {
    if (resetPwd !== RESET_PASSWORD) {
      setResetError(tx.invalidPassword)
      return
    }
    setResetError(null)
    await onReset()
    setResetPwd("")
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">{tx.title}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">{tx.summary}</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatCard label={tx.daysCompleted} value={String(stats.totalDays)} />
          <StatCard label={tx.totalSteps} value={totalsSplit.steps.toLocaleString("en-US")} />
          <StatCard label={tx.totalReps} value={totalsSplit.others.toLocaleString("en-US")} />
          <StatCard label={tx.streak} value={String(stats.streak)} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur text-left">
          <div className="text-xs text-neutral-400">{tx.now} ({tx.day} {day})</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-2xl font-semibold tabular-nums">{dayTotals.pct}%</div>
            <div className="text-xs text-neutral-500">
              {last ? `${tx.latest}: ${last.date} (${tx.day} ${last.day})` : tx.noCompletedDays}
            </div>
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
          <div className="text-sm font-semibold">{tx.last7}</div>
          <div className="mt-3 space-y-2">
            {stats.last7.length === 0 ? (
              <div className="text-sm text-neutral-400">{tx.historyEmpty}</div>
            ) : (
              stats.last7.map((h) => (
                <div
                  key={`${h.date}-${h.day}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold">{tx.day} {h.day}</div>
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
          <div className="text-sm font-semibold">{tx.repsByExercise}</div>
          <div className="mt-3 space-y-2">
            {Object.keys(historyByExercise).length === 0 ? (
              <div className="text-sm text-neutral-400">{tx.noData}</div>
            ) : (
              Object.entries(historyByExercise)
                .sort((a, b) => b[1] - a[1])
                .map(([name, reps]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="text-sm font-semibold">{trExerciseName(name)}</div>
                    <div className="text-sm font-semibold tabular-nums">{reps.toLocaleString("en-US")}</div>
                  </div>
                ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">{tx.reset}</div>
          <div className="mt-1 text-xs text-neutral-400">{tx.resetHint}</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder={tx.password}
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
            />
            <button
              type="button"
              onClick={doReset}
              className="h-11 w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/15"
            >
              {tx.resetAll}
            </button>
          </div>

          {resetError ? <div className="mt-2 text-xs text-red-200">{resetError}</div> : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">{tx.support}</div>
          <div className="mt-1 text-xs text-neutral-400">{tx.supportHint}</div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href="https://t.me/esha04"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
            >
              {tx.supportBtn}
            </a>
            <a
              href="https://boosty.to/esha04"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400 px-4 text-sm font-semibold text-neutral-950 shadow-sm transition active:scale-[0.99] hover:brightness-110"
            >
              {tx.supportProjectBtn}
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
