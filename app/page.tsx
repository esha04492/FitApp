"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"

const PROGRAM_NAME = "100 days v.2"
const RESET_PASSWORD = "0000"

function getOrCreateUserId() {
  const key = "user_id"
  const saved = localStorage.getItem(key)
  if (saved) return saved
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

type Exercise = {
  id: string // uuid from day_exercises
  name: string
  target_reps: number
  sort_order: number
}

type HistoryEntry = {
  day: number
  date: string // YYYY-MM-DD (локальная дата)
  totalDone: number
  totalTarget: number
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(val, max))
}

function localISODate() {
  return new Date().toLocaleDateString("sv-SE") // YYYY-MM-DD
}

function parseLocalDate(d: string) {
  return new Date(`${d}T00:00:00`)
}

function diffDays(a: string, b: string) {
  const da = parseLocalDate(a).getTime()
  const db = parseLocalDate(b).getTime()
  return Math.round((da - db) / (1000 * 60 * 60 * 24))
}

function computeStreaks(history: HistoryEntry[]) {
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

export default function Home() {
  const [dbg, setDbg] = useState<string>("")
  const [tab, setTab] = useState<"today" | "stats">("today")

  const [loading, setLoading] = useState(true)
  const [programId, setProgramId] = useState<string | null>(null)

  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [customInput, setCustomInput] = useState<Record<string, string>>({})

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, number>>({})

  useEffect(() => {
    const savedTab = localStorage.getItem("tab")
    if (savedTab === "today" || savedTab === "stats") setTab(savedTab)
  }, [])

  useEffect(() => {
    localStorage.setItem("tab", tab)
  }, [tab])

  const pretty = (n: number) => n.toLocaleString("ru-RU")

  const fetchHistory = async (uid: string, pid: string) => {
    const { data, error } = await supabase
      .from("user_day_history")
      .select("day_number, local_date, total_done, total_target")
      .eq("user_id", uid)
      .eq("program_id", pid)
      .order("day_number", { ascending: true })
      .limit(500)

    if (error) {
      setDbg("ERROR history: " + error.message)
      return
    }

    const mapped: HistoryEntry[] =
      data?.map((r) => ({
        day: r.day_number,
        date: r.local_date,
        totalDone: r.total_done,
        totalTarget: r.total_target,
      })) ?? []

    setHistory(mapped)
  }

  const fetchHistoryBreakdown = async (uid: string, pid: string) => {
    const { data, error } = await supabase
      .from("user_day_history_exercises")
      .select("exercise_name,reps_done")
      .eq("user_id", uid)
      .eq("program_id", pid)
      .limit(10000)

    if (error) {
      setDbg("ERROR history breakdown: " + error.message)
      return
    }

    const map: Record<string, number> = {}
    data?.forEach((r) => {
      map[r.exercise_name] = (map[r.exercise_name] || 0) + r.reps_done
    })
    setHistoryByExercise(map)
  }

  const loadDay = async (uid: string, pid: string, dayNumber: number) => {
    const { data: pd, error: pderr } = await supabase
      .from("program_days")
      .select("id, day_number")
      .eq("program_id", pid)
      .eq("day_number", dayNumber)
      .single()

    if (pderr || !pd) {
      setDbg("ERROR program_day: " + (pderr?.message ?? "not found"))
      setExercises([])
      setProgress({})
      return
    }

    const { data: exs, error: exerr } = await supabase
      .from("day_exercises")
      .select("id,name,target_reps,sort_order")
      .eq("program_day_id", pd.id)
      .order("sort_order")

    if (exerr) {
      setDbg("ERROR day_exercises: " + exerr.message)
      setExercises([])
      setProgress({})
      return
    }

    const exList = (exs as Exercise[]) ?? []
    setExercises(exList)

    if (exList.length === 0) {
      setProgress({})
      return
    }

    const ids = exList.map((x) => x.id)
    const { data: prog, error: prerr } = await supabase
      .from("user_exercise_progress")
      .select("day_exercise_id,reps_done")
      .eq("user_id", uid)
      .in("day_exercise_id", ids)

    if (prerr) {
      setDbg("ERROR progress load: " + prerr.message)
      setProgress({})
      return
    }

    const map: Record<string, number> = {}
    prog?.forEach((p) => {
      map[p.day_exercise_id] = p.reps_done
    })
    setProgress(map)
  }

  // INIT
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const uid = getOrCreateUserId()

      const { data: program, error: perr } = await supabase
        .from("programs")
        .select("id,name,total_days")
        .eq("name", PROGRAM_NAME)
        .single()

      if (perr || !program) {
        setDbg("ERROR program: " + (perr?.message ?? "not found"))
        setLoading(false)
        return
      }
      setProgramId(program.id)

      let { data: state } = await supabase
        .from("user_state")
        .select("user_id,program_id,current_day")
        .eq("user_id", uid)
        .single()

      if (!state) {
        const { data: newState, error: serr } = await supabase
          .from("user_state")
          .insert({ user_id: uid, program_id: program.id, current_day: 1 })
          .select()
          .single()

        if (serr || !newState) {
          setDbg("ERROR user_state: " + (serr?.message ?? "cannot create"))
          setLoading(false)
          return
        }
        state = newState
      }

      if (!state) {
        setDbg("ERROR user_state: still null")
        setLoading(false)
        return
      }

      setDay(state.current_day)
      await loadDay(uid, program.id, state.current_day)
      await fetchHistory(uid, program.id)
      await fetchHistoryBreakdown(uid, program.id)

      setDbg(`OK: ${program.name}, day ${state.current_day}`)
      setLoading(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ Day progress: equal-weight average across exercises
  const dayTotals = useMemo(() => {
    if (exercises.length === 0) return { pct: 0 }

    const sum = exercises.reduce((acc, ex) => {
      const done = progress[ex.id] || 0
      const frac = ex.target_reps === 0 ? 0 : done / ex.target_reps
      return acc + clamp(frac, 0, 1)
    }, 0)

    const pct = Math.round((sum / exercises.length) * 100)
    return { pct: clamp(pct, 0, 100) }
  }, [progress, exercises])

  const allCompleted = useMemo(() => {
    return exercises.length > 0 && exercises.every((ex) => (progress[ex.id] || 0) >= ex.target_reps)
  }, [exercises, progress])

  const updateReps = async (id: string, change: number, target: number) => {
    const uid = getOrCreateUserId()

    const current = progress[id] || 0
    const updated = Math.max(0, current + change)

    setProgress((prev) => ({ ...prev, [id]: updated }))

    const { error } = await supabase
      .from("user_exercise_progress")
      .upsert({ user_id: uid, day_exercise_id: id, reps_done: updated })

    if (error) setDbg("ERROR save progress: " + error.message)
  }

  const addCustomReps = async (id: string, target: number) => {
    const raw = customInput[id]
    const value = Number(raw)
    if (!raw || Number.isNaN(value) || value === 0) return

    await updateReps(id, value, target)
    setCustomInput((prev) => ({ ...prev, [id]: "" }))
  }

  const nextDay = async (force = false) => {
    if (!allCompleted && !force) return
    const uid = getOrCreateUserId()
    if (!programId) return

    const entryDate = localISODate()

    // totals for history (old style)
    const totalDone = exercises.reduce((s, ex) => s + (progress[ex.id] || 0), 0)
    const totalTarget = exercises.reduce((s, ex) => s + ex.target_reps, 0)

    // 1) write totals history
    const { error: herr } = await supabase.from("user_day_history").upsert({
      user_id: uid,
      program_id: programId,
      day_number: day,
      local_date: entryDate,
      total_done: totalDone,
      total_target: totalTarget,
      skipped: force,
    })

    if (herr) {
      setDbg("ERROR history save: " + herr.message)
      return
    }

    // 1b) write per-exercise breakdown
    const breakdownRows = exercises.map((ex) => ({
      user_id: uid,
      program_id: programId,
      day_number: day,
      local_date: entryDate,
      exercise_name: ex.name,
      reps_done: progress[ex.id] || 0,
      reps_target: ex.target_reps,
    }))

    const { error: berr } = await supabase.from("user_day_history_exercises").upsert(breakdownRows)
    if (berr) {
      setDbg("ERROR breakdown save: " + berr.message)
      return
    }

    // 2) increment user_state day
    const { error: uerr } = await supabase
      .from("user_state")
      .update({ current_day: day + 1, updated_at: new Date().toISOString() })
      .eq("user_id", uid)

    if (uerr) {
      setDbg("ERROR user_state update: " + uerr.message)
      return
    }

    // 3) clear progress for old day exercises
    const ids = exercises.map((e) => e.id)
    if (ids.length) {
      const { error: derr } = await supabase
        .from("user_exercise_progress")
        .delete()
        .eq("user_id", uid)
        .in("day_exercise_id", ids)

      if (derr) setDbg("ERROR clear progress: " + derr.message)
    }

    // 4) move to next day + load
    const next = day + 1
    setDay(next)
    setProgress({})
    setCustomInput({})
    setTab("stats")

    await loadDay(uid, programId, next)
    await fetchHistory(uid, programId)
    await fetchHistoryBreakdown(uid, programId)

    setDbg(`OK: ${PROGRAM_NAME}, day ${next}`)
  }

  const totalsSplit = useMemo(() => {
    const entries = Object.entries(historyByExercise)
    const steps = entries.reduce((s, [name, v]) => s + (name.toLowerCase() === "шаги" ? v : 0), 0)
    const others = entries.reduce((s, [name, v]) => s + (name.toLowerCase() === "шаги" ? 0 : v), 0)
    return { steps, others }
  }, [historyByExercise])

  const stats = useMemo(() => {
    const totalDays = history.length
    const totalReps = history.reduce((s, h) => s + h.totalDone, 0)
    const { current } = computeStreaks(history)
    const last7 = [...history].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 7)
    return { totalDays, totalReps, streak: current, last7 }
  }, [history])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-sm text-neutral-400">Минутку…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
    
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/10 via-fuchsia-500/5 to-transparent" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6 pb-24">
        {tab === "today" ? (
          <TodayView
            day={day}
            exercises={exercises}
            progress={progress}
            customInput={customInput}
            setCustomInput={setCustomInput}
            updateReps={updateReps}
            addCustomReps={addCustomReps}
            nextDay={() => nextDay()}
            skipDay={() => nextDay(true)}
            allCompleted={allCompleted}
            dayTotals={dayTotals}
            currentStreak={stats.streak}
            pretty={pretty}
          />
        ) : (
          <StatsView
          totalsSplit={totalsSplit}
            day={day}
            dayTotals={dayTotals}
            history={history}
            stats={stats}
            historyByExercise={historyByExercise}
            onReset={async () => {
              const uid = getOrCreateUserId()
              if (!programId) return

              await supabase.from("user_exercise_progress").delete().eq("user_id", uid)
              await supabase.from("user_day_history").delete().eq("user_id", uid).eq("program_id", programId)
              await supabase.from("user_day_history_exercises").delete().eq("user_id", uid).eq("program_id", programId)
              await supabase.from("user_state").update({ current_day: 1 }).eq("user_id", uid)

              setDay(1)
              setExercises([])
              setProgress({})
              setCustomInput({})
              setHistory([])
              setHistoryByExercise({})
              setTab("today")

              await loadDay(uid, programId, 1)
              await fetchHistory(uid, programId)
              await fetchHistoryBreakdown(uid, programId)

              setDbg("RESET OK")
            }}
          />
        )}
      </div>

      <TabBar tab={tab} setTab={setTab} />
    </div>
  )
}

function TodayView(props: {
  day: number
  currentStreak: number
  exercises: Exercise[]
  progress: Record<string, number>
  customInput: Record<string, string>
  setCustomInput: React.Dispatch<React.SetStateAction<Record<string, string>>>
  updateReps: (id: string, change: number, target: number) => Promise<void>
  addCustomReps: (id: string, target: number) => Promise<void>
  nextDay: () => Promise<void>
  skipDay: () => Promise<void>
  allCompleted: boolean
  dayTotals: { pct: number }
  pretty: (n: number) => string
}) {
  const [showSkip, setShowSkip] = useState(false)
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

  return (
    <>
      {/* Header */}
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">Тренировка</div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <div className="text-3xl font-semibold tracking-tight">{"\u0414\u0435\u043d\u044c "}{day}</div>
          {currentStreak > 0 ? (
            <span className="animate-pulse rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
              {"\ud83d\udd25 \u0414\u043d\u0435\u0439 \u043f\u043e\u0434\u0440\u044f\u0434 "}
              <span className="font-bold">{currentStreak}</span>
              {" \ud83d\udd25"}
            </span>
          ) : null}
        </div>

        {/* Day summary */}
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

      {/* Exercises */}
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

              {/* Big reps */}
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="text-4xl font-semibold tabular-nums tracking-tight">
                  {pretty(reps)}
                  <span className="text-xl text-neutral-500"> / {pretty(ex.target_reps)}</span>
                </div>
                <div className="text-sm text-neutral-400 tabular-nums">{percent}%</div>
              </div>

              {/* Progress bar */}
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

              {/* Controls */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {isSteps ? (
                  <>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -2000, ex.target_reps)}>
                      −2000
                    </ActionBtn>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -1000, ex.target_reps)}>
                      −1000
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
                      −10
                    </ActionBtn>
                    <ActionBtn variant="ghost" onClick={() => updateReps(ex.id, -5, ex.target_reps)}>
                      −5
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

              {/* Custom input 50/50 */}
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

      {/* Next day */}
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
          {"\u041f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0434\u0435\u043d\u044c"}
        </button>
      </div>

      {showSkip ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 px-5 py-4 shadow-2xl">
            <div className="text-base font-semibold text-neutral-100">
              {"\u0422\u044b \u0443\u0432\u0435\u0440\u0435\u043d, \u0447\u0442\u043e \u0445\u043e\u0447\u0435\u0448\u044c \u043f\u0440\u043e\u043f\u0443\u0441\u0442\u0438\u0442\u044c \u0434\u0435\u043d\u044c?"}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSkip(false)}
                className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
              >
                {"\u041d\u0435\u0442"}
              </button>
              <button
                onClick={async () => {
                  setShowSkip(false)
                  await skipDay()
                }}
                className="h-9 rounded-xl border border-red-400/30 bg-red-500/15 px-3 text-xs font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/25"
              >
                {"\u0414\u0430"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function StatsView(props: {
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
      setResetError("Неверный пароль")
      return
    }
    setResetError(null)
    await onReset()
    setResetPwd("")
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">Статистика</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight">Сводка</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
<StatCard label="Дней завершено" value={String(stats.totalDays)} />
<StatCard label="Шагов всего" value={totalsSplit.steps.toLocaleString("ru-RU")} />
<StatCard label="Повторений всего" value={totalsSplit.others.toLocaleString("ru-RU")} />
<StatCard label="Streak" value={String(stats.streak)} />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur text-left">
          <div className="text-xs text-neutral-400">Сейчас (День {day})</div>
          <div className="mt-1 flex items-end justify-between">
            <div className="text-2xl font-semibold tabular-nums">{dayTotals.pct}%</div>
            <div className="text-xs text-neutral-500">{last ? `Последнее: ${last.date} (День ${last.day})` : "Пока нет завершений"}</div>
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
          <div className="text-sm font-semibold">Последние 7 дней</div>
          <div className="mt-3 space-y-2">
            {stats.last7.length === 0 ? (
              <div className="text-sm text-neutral-400">Когда завершишь день — тут появится история.</div>
            ) : (
              stats.last7.map((h) => (
                <div
                  key={`${h.date}-${h.day}`}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div>
                    <div className="text-sm font-semibold">День {h.day}</div>
                    <div className="text-xs text-neutral-400">{h.date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {h.totalDone.toLocaleString("ru-RU")}
                      <span className="text-neutral-500"> / {h.totalTarget.toLocaleString("ru-RU")}</span>
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
          <div className="text-sm font-semibold">Повторения по упражнениям</div>
          <div className="mt-3 space-y-2">
            {Object.keys(historyByExercise).length === 0 ? (
              <div className="text-sm text-neutral-400">Пока нет данных. Закрой хотя бы один день.</div>
            ) : (
              Object.entries(historyByExercise)
                .sort((a, b) => b[1] - a[1])
                .map(([name, reps]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-sm font-semibold tabular-nums">{reps.toLocaleString("ru-RU")}</div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Reset (password protected) */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="text-sm font-semibold">Сброс</div>
          <div className="mt-1 text-xs text-neutral-400">Защита от случайного нажатия. Пароль: 0000</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Пароль"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
            />
            <button
              onClick={doReset}
              className="h-11 w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/15"
            >
              Сбросить всё
            </button>
          </div>

          {resetError ? <div className="mt-2 text-xs text-red-200">{resetError}</div> : null}
        </div>
      </div>
    </>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur text-left">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function TabBar({
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
  children: React.ReactNode
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

function ActionBtn({
  children,
  onClick,
  variant,
}: {
  children: React.ReactNode
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
