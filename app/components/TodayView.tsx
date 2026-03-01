"use client"
import { useState, type Dispatch, type SetStateAction } from "react"
import ActionBtn from "./ActionBtn"
import { clamp } from "../lib/date"
import type { Exercise } from "./types"

export default function TodayView(props: {
  day: number
  currentStreak: number
  exercises: Exercise[]
  progress: Record<string, number>
  customInput: Record<string, string>
  setCustomInput: Dispatch<SetStateAction<Record<string, string>>>
  updateReps: (id: string, change: number, target: number) => Promise<void>
  addCustomReps: (id: string, target: number) => Promise<void>
  nextDay: () => Promise<void>
  skipDay: () => Promise<void>
  allCompleted: boolean
  dayTotals: { pct: number }
  pretty: (n: number) => string
}) {
  const [showSkip, setShowSkip] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("onboarding_dismissed") !== "1"
  })
  const {
    day,
    currentStreak,
    exercises,
    progress,
    customInput,
    setCustomInput,
    updateReps,
    addCustomReps,
    nextDay,
    skipDay,
    allCompleted,
    dayTotals,
    pretty,
  } = props

  const dismissOnboarding = () => {
    localStorage.setItem("onboarding_dismissed", "1")
    setShowOnboarding(false)
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">Тренировка</div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <div className="text-3xl font-semibold tracking-tight">{"День "}{day}</div>
          {currentStreak > 0 ? (
            <span className="animate-pulse rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
              {"🔥 Дней подряд "}
              <span className="font-bold">{currentStreak}</span>
              {" 🔥"}
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div className="text-left">
              <div className="text-xs text-neutral-400">Прогресс дня</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{dayTotals.pct}%</div>
            </div>

            <div className="text-right text-xs text-neutral-500">{allCompleted ? "День закрыт ✅" : "До закрытия дня"}</div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400 transition-all duration-300"
              style={{ width: `${dayTotals.pct}%` }}
            />
          </div>
        </div>
      </div>

      {showOnboarding ? (
        <div className="relative mb-4 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <button
            onClick={dismissOnboarding}
            className="absolute right-3 top-3 h-7 w-7 rounded-full border border-white/10 bg-white/5 text-xs text-neutral-300 transition hover:bg-white/10 hover:text-neutral-100"
            aria-label="Закрыть онбординг"
          >
            X
          </button>
          <div className="pr-10 text-center">
            <div className="text-sm font-semibold text-neutral-100">FitStreak — 100 дней дисциплины</div>
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-neutral-300">
              {"Это приложение для 100-дневного челленджа. Каждый день отмечай выполнение упражнений, следи за серией (streak) и старайся не прерывать её.\nМожно пропустить день, но серия обнулится.\nЖми «Следующий день», когда закроешь все упражнения. Погнали 💪"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {exercises.map((ex) => {
          const reps = progress[ex.id] || 0
          const isCompleted = reps >= ex.target_reps
          const percent = clamp(Math.round((reps / ex.target_reps) * 100), 0, 100)
          const remaining = Math.max(ex.target_reps - reps, 0)
          const isSteps = ex.name.toLowerCase() === "шаги"

          return (
            <div
              key={ex.id}
              className={`rounded-3xl border bg-white/5 p-4 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)] backdrop-blur ${
                isCompleted ? "border-emerald-400/40" : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-400">Упражнение</div>
                  <div className="mt-0.5 text-lg font-semibold">{ex.name}</div>
                </div>

                {isCompleted ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                    Выполнено
                  </span>
                ) : (
                  <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                    Осталось {pretty(remaining)}
                  </span>
                )}
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="text-4xl font-semibold tabular-nums tracking-tight">
                  {pretty(reps)}
                  <span className="text-xl text-neutral-500"> / {pretty(ex.target_reps)}</span>
                </div>
                <div className="text-sm text-neutral-400 tabular-nums">{percent}%</div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isCompleted
                      ? "bg-gradient-to-r from-emerald-300 to-emerald-500"
                      : "bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400"
                  }`}
                  style={{ width: `${percent}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {isSteps ? (
                  <>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -2000, ex.target_reps)}>
                      -2000
                    </ActionBtn>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -1000, ex.target_reps)}>
                      -1000
                    </ActionBtn>
                    <ActionBtn variant="primary" onClick={() => updateReps(ex.id, 1000, ex.target_reps)}>
                      +1000
                    </ActionBtn>
                    <ActionBtn variant="primaryStrong" onClick={() => updateReps(ex.id, 2000, ex.target_reps)}>
                      +2000
                    </ActionBtn>
                  </>
                ) : (
                  <>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -10, ex.target_reps)}>
                      -10
                    </ActionBtn>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -5, ex.target_reps)}>
                      -5
                    </ActionBtn>
                    <ActionBtn variant="primary" onClick={() => updateReps(ex.id, 5, ex.target_reps)}>
                      +5
                    </ActionBtn>
                    <ActionBtn variant="primaryStrong" onClick={() => updateReps(ex.id, 10, ex.target_reps)}>
                      +10
                    </ActionBtn>
                  </>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  inputMode="numeric"
                  type="number"
                  placeholder="Свое число"
                  value={customInput[ex.id] || ""}
                  onChange={(e) =>
                    setCustomInput((prev) => ({
                      ...prev,
                      [ex.id]: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />

                <button
                  onClick={() => addCustomReps(ex.id, ex.target_reps)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 shadow-sm transition active:scale-[0.99] hover:bg-white/10"
                >
                  Добавить
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6">
        <button
          disabled={!allCompleted}
          onClick={nextDay}
          className={`h-12 w-full rounded-2xl px-4 text-sm font-semibold shadow-sm transition active:scale-[0.99] ${
            allCompleted
              ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-neutral-950"
              : "bg-white/5 text-neutral-500 border border-white/10 cursor-not-allowed"
          }`}
        >
          Следующий день
        </button>
        <button
          onClick={() => setShowSkip(true)}
          className="mt-3 text-xs text-neutral-500 hover:text-neutral-300 transition"
        >
          {"Пропустить день"}
        </button>
      </div>

      {showSkip ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 px-5 py-4 shadow-2xl">
            <div className="text-base font-semibold text-neutral-100">
              {"Ты уверен, что хочешь пропустить день?"}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSkip(false)}
                className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
              >
                {"Нет"}
              </button>
              <button
                onClick={async () => {
                  setShowSkip(false)
                  await skipDay()
                }}
                className="h-9 rounded-xl border border-red-400/30 bg-red-500/15 px-3 text-xs font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/25"
              >
                {"Да"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
