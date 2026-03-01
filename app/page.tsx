"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import type { Exercise, HistoryEntry } from "./components/types"
import ProgramPicker from "./components/ProgramPicker"
import CustomProgramBuilder from "./components/CustomProgramBuilder"
import TodayView from "./components/TodayView"
import StatsView from "./components/StatsView"
import TabBar from "./components/TabBar"
import { clamp, computeStreaks, localISODate } from "./lib/date"
const PROGRAM_NAME = "100 days v.2"

type TgWindow = Window & {
  Telegram?: {
    WebApp?: {
      initData?: string
      initDataUnsafe?: { user?: { id?: number | string } }
    }
  }
}

function readTelegramUserId(): string | null {
  if (typeof window === "undefined") return null
  const tg = (window as TgWindow).Telegram
  const directId = tg?.WebApp?.initDataUnsafe?.user?.id
  if (directId != null) return String(directId)

  const initData = tg?.WebApp?.initData
  if (!initData) return null

  try {
    const params = new URLSearchParams(initData)
    const rawUser = params.get("user")
    if (!rawUser) return null
    const parsed = JSON.parse(rawUser) as { id?: number | string }
    if (parsed.id == null) return null
    return String(parsed.id)
  } catch {
    return null
  }
}

async function getOrCreateUserId() {
  const identity = await getUserIdentity()
  return identity.id
}

async function getUserIdentity(): Promise<{ id: string; source: "telegram" | "local" }> {
  const key = "user_id"
  const inTelegram = typeof window !== "undefined" && Boolean((window as TgWindow).Telegram?.WebApp)

  for (let i = 0; i < 20; i += 1) {
    const telegramUserId = readTelegramUserId()
    if (telegramUserId) {
      localStorage.setItem(key, telegramUserId)
      return { id: telegramUserId, source: "telegram" }
    }
    if (!inTelegram) break
    await new Promise((resolve) => setTimeout(resolve, 75))
  }

  if (inTelegram) {
    // Do not reuse a previous local user id inside Telegram if user.id was not resolved.
    const fresh = crypto.randomUUID()
    localStorage.setItem(key, fresh)
    return { id: fresh, source: "local" }
  }

  const saved = localStorage.getItem(key)
  if (saved) return { id: saved, source: "local" }
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return { id, source: "local" }
}

export default function Home() {
  const [dbg, setDbg] = useState<string>("")
  const [tab, setTab] = useState<"today" | "stats">("today")

  const [loading, setLoading] = useState(true)
  const [programId, setProgramId] = useState<string | number | null>(null)
  const [isLoadingProgram, setIsLoadingProgram] = useState(true)
  const [showProgramMenu, setShowProgramMenu] = useState(true)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)

  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [customInput, setCustomInput] = useState<Record<string, string>>({})

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, number>>({})
  const [identityDebug, setIdentityDebug] = useState<string>("")

  useEffect(() => {
    const savedTab = localStorage.getItem("tab")
    if (savedTab === "today" || savedTab === "stats") setTab(savedTab)
  }, [])

  useEffect(() => {
    localStorage.setItem("tab", tab)
  }, [tab])

  const pretty = (n: number) => n.toLocaleString("ru-RU")

  const fetchHistory = async (uid: string, pid: string | number) => {
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

  const fetchHistoryBreakdown = async (uid: string, pid: string | number) => {
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

  const loadDay = async (uid: string, pid: string | number, dayNumber: number) => {
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

    let exList: Exercise[] = []
    const { data: exs, error: exerr } = await supabase
      .from("day_exercises")
      .select("id,name,target_reps,sort_order")
      .eq("program_day_id", pd.id)
      .order("sort_order")

    if (!exerr) {
      exList = (exs as Exercise[]) ?? []
    } else {
      const { data: fallbackExs, error: fallbackErr } = await supabase
        .from("day_exercises")
        .select("id,name,target,sort_order")
        .eq("program_day_id", pd.id)
        .order("sort_order")

      if (fallbackErr) {
        setDbg("ERROR day_exercises: " + fallbackErr.message)
        setExercises([])
        setProgress({})
        return
      }

      exList =
        fallbackExs?.map((row) => ({
          id: row.id,
          name: row.name,
          target_reps: row.target,
          sort_order: row.sort_order,
        })) ?? []
    }
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
      setIsLoadingProgram(true)
      const identity = await getUserIdentity()
      const uid = identity.id
      const debugEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1"
      setIdentityDebug(debugEnabled ? `uid: ${uid} (source: ${identity.source})` : "")
      const { data: states, error: stateErr } = await supabase
        .from("user_state")
        .select("user_id,program_id,current_day,updated_at")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false })
        .limit(1)

      if (stateErr) {
        setDbg("ERROR user_state: " + stateErr.message)
      }

      const state = states?.[0] ?? null

      if (!state) {
        setDay(1)
        setProgramId(null)
        setShowProgramMenu(true)
        setLoading(false)
        setIsLoadingProgram(false)
        return
      }

      const currentDay = state.current_day ?? 1
      const selectedProgramId = state.program_id as string | number | null

      setDay(currentDay)
      setProgramId(selectedProgramId)
      setShowProgramMenu(selectedProgramId == null)

      if (selectedProgramId == null) {
        setLoading(false)
        setIsLoadingProgram(false)
        return
      }

      await loadDay(uid, selectedProgramId, currentDay)
      await fetchHistory(uid, selectedProgramId)
      await fetchHistoryBreakdown(uid, selectedProgramId)

      setDbg(`OK: ${PROGRAM_NAME}, day ${currentDay}`)
      setLoading(false)
      setIsLoadingProgram(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const chooseBuiltInProgram = async () => {
    const uid = await getOrCreateUserId()
    setIsLoadingProgram(true)

    let selectedProgramId: string | number | null = null
    const startDay = 1

    const { data: existingBuiltIn, error: existingBuiltInErr } = await supabase
      .from("programs")
      .select("id")
      .eq("name", PROGRAM_NAME)
      .is("owner_user_id", null)
      .order("id", { ascending: false })
      .limit(50)

    if (!existingBuiltInErr && existingBuiltIn?.length) {
      for (const row of existingBuiltIn) {
        const { data: firstDay } = await supabase
          .from("program_days")
          .select("id")
          .eq("program_id", row.id)
          .eq("day_number", 1)
          .limit(1)
        if (firstDay && firstDay.length > 0) {
          selectedProgramId = row.id
          break
        }
      }
    }

    if (selectedProgramId == null) {
      const { data: anyByName, error: anyByNameErr } = await supabase
        .from("programs")
        .select("id")
        .eq("name", PROGRAM_NAME)
        .order("id", { ascending: false })
        .limit(50)

      if (!anyByNameErr && anyByName?.length) {
        for (const row of anyByName) {
          const { data: firstDay } = await supabase
            .from("program_days")
            .select("id")
            .eq("program_id", row.id)
            .eq("day_number", 1)
            .limit(1)
          if (firstDay && firstDay.length > 0) {
            selectedProgramId = row.id
            break
          }
        }
      }
    }

    if (selectedProgramId == null) {
      setDbg("ERROR program select: built-in program not found")
      setIsLoadingProgram(false)
      return
    }

    setProgramId(selectedProgramId)
    setShowProgramMenu(false)
    setShowCustomBuilder(false)
    setTab("today")
    setDay(startDay)

    const { data: updatedRows, error: updateErr } = await supabase
      .from("user_state")
      .update({ program_id: selectedProgramId, current_day: startDay })
      .eq("user_id", uid)
      .select("user_id")
      .limit(1)

    if (updateErr) {
      setDbg("ERROR program assign: " + updateErr.message)
    } else if (!updatedRows || updatedRows.length === 0) {
      const { error: insertStateErr } = await supabase
        .from("user_state")
        .insert({ user_id: uid, program_id: selectedProgramId, current_day: startDay })
      if (insertStateErr) {
        setDbg("ERROR user_state create: " + insertStateErr.message)
      }
    }

    await loadDay(uid, selectedProgramId, startDay)
    await fetchHistory(uid, selectedProgramId)
    await fetchHistoryBreakdown(uid, selectedProgramId)

    setLoading(false)
    setIsLoadingProgram(false)
  }
  const createCustomProgram = async (payload: {
    name: string
    exercises: Array<{ name: string; target: number; unit: "reps" | "steps" }>
  }) => {
    const uid = await getOrCreateUserId()
    const programName = payload.name.trim()
    const exList = payload.exercises
      .map((x) => ({
        name: x.name.trim(),
        target: Math.max(1, Number(x.target) || 0),
        unit: x.unit,
      }))
      .filter((x) => x.name.length > 0)

    if (!programName) return { ok: false, error: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u044b" }
    if (exList.length === 0) return { ok: false, error: "\u0414\u043e\u0431\u0430\u0432\u044c\u0442\u0435 \u0445\u043e\u0442\u044f \u0431\u044b \u043e\u0434\u043d\u043e \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u0435" }

    setIsLoadingProgram(true)
    setDbg("")

    try {
      const res = await fetch("/api/programs/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: uid,
          name: programName,
          exercises: exList,
        }),
      })

      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; programId?: string | number }
        | null

      if (!res.ok || !body?.ok || body.programId == null) {
        const message = body?.error ?? "\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0443"
        setDbg("ERROR custom program create: " + message)
        setIsLoadingProgram(false)
        return { ok: false, error: message }
      }

      const programIdNew = body.programId
      setProgramId(programIdNew)
      setShowProgramMenu(false)
      setShowCustomBuilder(false)
      setTab("today")
      setDay(1)
      setProgress({})
      setCustomInput({})

      await loadDay(uid, programIdNew, 1)
      await fetchHistory(uid, programIdNew)
      await fetchHistoryBreakdown(uid, programIdNew)

      setLoading(false)
      setIsLoadingProgram(false)
      return { ok: true }
    } catch (e) {
      const message = e instanceof Error ? e.message : "\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430"
      setDbg("ERROR custom program create: " + message)
      setIsLoadingProgram(false)
      return { ok: false, error: message }
    }
  }
  // Day progress: equal-weight average across exercises
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
    const uid = await getOrCreateUserId()

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

  const editExercise = async (payload: {
    exerciseId: string
    originalName: string
    name: string
    target: number
    applyTo: "today" | "program"
  }): Promise<{ ok: boolean; error?: string }> => {
    if (programId == null) return { ok: false, error: "Program is not selected" }
    const trimmedName = payload.name.trim()
    const safeTarget = Math.max(1, Number(payload.target) || 0)
    if (!trimmedName) return { ok: false, error: "Name is required" }

    try {
      if (payload.applyTo === "today") {
        const { error: err1 } = await supabase
          .from("day_exercises")
          .update({ name: trimmedName, target_reps: safeTarget })
          .eq("id", payload.exerciseId)
        if (err1) {
          const { error: err2 } = await supabase
            .from("day_exercises")
            .update({ name: trimmedName, target: safeTarget })
            .eq("id", payload.exerciseId)
          if (err2) {
            return { ok: false, error: err2.message ?? err1.message ?? "Update failed" }
          }
        }
      } else {
        const { data: dayRows, error: daysErr } = await supabase
          .from("program_days")
          .select("id")
          .eq("program_id", programId)
        if (daysErr) return { ok: false, error: daysErr.message }
        const dayIds = dayRows?.map((x) => x.id) ?? []
        if (dayIds.length === 0) return { ok: false, error: "Program days not found" }

        const { error: err1 } = await supabase
          .from("day_exercises")
          .update({ name: trimmedName, target_reps: safeTarget })
          .in("program_day_id", dayIds)
          .eq("name", payload.originalName)
        if (err1) {
          const { error: err2 } = await supabase
            .from("day_exercises")
            .update({ name: trimmedName, target: safeTarget })
            .in("program_day_id", dayIds)
            .eq("name", payload.originalName)
          if (err2) {
            return { ok: false, error: err2.message ?? err1.message ?? "Update failed" }
          }
        }
      }

      const uid = await getOrCreateUserId()
      await loadDay(uid, programId, day)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown error" }
    }
  }

  const nextDay = async (force = false) => {
    if (!allCompleted && !force) return
    const uid = await getOrCreateUserId()
    if (programId == null) return

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
    const steps = entries.reduce((s, [name, v]) => s + (name.toLowerCase() === "\u0448\u0430\u0433\u0438" ? v : 0), 0)
    const others = entries.reduce((s, [name, v]) => s + (name.toLowerCase() === "\u0448\u0430\u0433\u0438" ? 0 : v), 0)
    return { steps, others }
  }, [historyByExercise])

  const stats = useMemo(() => {
    const totalDays = history.length
    const totalReps = history.reduce((s, h) => s + h.totalDone, 0)
    const { current } = computeStreaks(history)
    const last7 = [...history].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 7)
    return { totalDays, totalReps, streak: current, last7 }
  }, [history])

  if (loading || isLoadingProgram) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-sm text-neutral-400">{"\u041c\u0438\u043d\u0443\u0442\u043a\u0443..."}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
    
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/10 via-fuchsia-500/5 to-transparent" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6 pb-24">
        {identityDebug ? <div className="mb-2 text-[11px] text-neutral-500">{identityDebug}</div> : null}
        {dbg.startsWith("ERROR") ? (
          <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {dbg}
          </div>
        ) : null}
        {showProgramMenu || programId == null ? (
          showCustomBuilder ? (
            <CustomProgramBuilder onBack={() => setShowCustomBuilder(false)} onCreate={createCustomProgram} />
          ) : (
            <ProgramPicker
              onPickBuiltIn={chooseBuiltInProgram}
              onPickCustom={() => setShowCustomBuilder(true)}
              loading={isLoadingProgram}
            />
          )
        ) : tab === "today" ? (
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
            editExercise={editExercise}
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
              const uid = await getOrCreateUserId()
              if (programId == null) return

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

      {programId == null ? null : <TabBar tab={tab} setTab={setTab} />}
    </div>
  )
}
