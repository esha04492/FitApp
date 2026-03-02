"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import type { Exercise, HistoryEntry } from "./components/types"
import ProgramPicker from "./components/ProgramPicker"
import CustomProgramBuilder from "./components/CustomProgramBuilder"
import type { BuilderExercise } from "./components/CustomProgramBuilder"
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
      ready?: () => void
    }
  }
}

type StrictIdentity = { id: string | null; source: "telegram" | "telegram_no_id" | "local" }
type IdentityDiagnostics = {
  hasTelegramObject: boolean
  hasWebAppObject: boolean
  hasInitDataUnsafeUserId: boolean
  hasTelegramUserAgent: boolean
  userAgent: string
  referrer: string
  initDataLength: number
  hasTgWebAppDataParam: boolean
  hasSignedUidParams: boolean
  tgWebAppParamKeys: string[]
  parsedUserIdFromInitData: string | null
  parsedUserIdFromUrl: string | null
}

function isTelegramContext(): boolean {
  if (typeof window === "undefined") return false
  const hasTelegramUA = /Telegram/i.test(navigator.userAgent)
  if ((window as TgWindow).Telegram?.WebApp) {
    sessionStorage.setItem("tg_context", "1")
    return true
  }

  const params = new URLSearchParams(window.location.search)
  if (params.has("tgWebAppData") || params.has("tgWebAppVersion")) {
    sessionStorage.setItem("tg_context", "1")
    return true
  }
  for (const key of params.keys()) {
    if (key.startsWith("tgWebApp")) {
      sessionStorage.setItem("tg_context", "1")
      return true
    }
  }
  if (sessionStorage.getItem("tg_context") === "1") return true
  if (hasTelegramUA) return true
  return false
}

function parseUserIdFromInitData(initData: string | undefined): string | null {
  if (!initData) return null
  const candidates = [initData]
  try {
    candidates.push(decodeURIComponent(initData))
  } catch {
    // no-op
  }
  try {
    candidates.push(decodeURIComponent(decodeURIComponent(initData)))
  } catch {
    // no-op
  }

  for (const candidate of candidates) {
    try {
      const params = new URLSearchParams(candidate)
      const rawUser = params.get("user")
      if (!rawUser) continue
      const parsed = JSON.parse(rawUser) as { id?: number | string }
      if (parsed.id == null) continue
      return String(parsed.id)
    } catch {
      // try next candidate
    }
  }
  return null
}

function parseUserIdFromUrl(): string | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const tgWebAppData = params.get("tgWebAppData")
  if (!tgWebAppData) return null
  const direct = parseUserIdFromInitData(tgWebAppData)
  if (direct) return direct
  return parseUserIdFromInitData(tgWebAppData.replace(/\+/g, "%20"))
}

function getSignedUidParams(): { uid: string; ts: string; sig: string } | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const uid = params.get("tg_uid")
  const ts = params.get("tg_ts")
  const sig = params.get("tg_sig")
  if (!uid || !ts || !sig) return null
  return { uid, ts, sig }
}

async function resolveSignedUidFromServer(): Promise<string | null> {
  if (typeof window === "undefined") return null
  const signed = getSignedUidParams()
  if (!signed) return null

  try {
    const url = `/api/telegram/resolve?uid=${encodeURIComponent(signed.uid)}&ts=${encodeURIComponent(
      signed.ts
    )}&sig=${encodeURIComponent(signed.sig)}`
    const res = await fetch(url, { method: "GET" })
    if (!res.ok) return null
    const body = (await res.json().catch(() => null)) as { ok?: boolean; userId?: string } | null
    if (!body?.ok || !body.userId) return null
    return body.userId
  } catch {
    return null
  }
}

function getIdentityDiagnostics(): IdentityDiagnostics {
  if (typeof window === "undefined") {
    return {
      hasTelegramObject: false,
      hasWebAppObject: false,
      hasInitDataUnsafeUserId: false,
      hasTelegramUserAgent: false,
      userAgent: "",
      referrer: "",
      initDataLength: 0,
      hasTgWebAppDataParam: false,
      hasSignedUidParams: false,
      tgWebAppParamKeys: [],
      parsedUserIdFromInitData: null,
      parsedUserIdFromUrl: null,
    }
  }

  const tg = (window as TgWindow).Telegram
  const webApp = tg?.WebApp
  const params = new URLSearchParams(window.location.search)
  const tgKeys = Array.from(params.keys()).filter((k) => k.startsWith("tgWebApp"))

  return {
    hasTelegramObject: Boolean(tg),
    hasWebAppObject: Boolean(webApp),
    hasInitDataUnsafeUserId: webApp?.initDataUnsafe?.user?.id != null,
    hasTelegramUserAgent: /Telegram/i.test(navigator.userAgent),
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    initDataLength: webApp?.initData?.length ?? 0,
    hasTgWebAppDataParam: params.has("tgWebAppData"),
    hasSignedUidParams: Boolean(getSignedUidParams()),
    tgWebAppParamKeys: tgKeys,
    parsedUserIdFromInitData: parseUserIdFromInitData(webApp?.initData),
    parsedUserIdFromUrl: parseUserIdFromUrl(),
  }
}

function getUserIdStrict(): StrictIdentity {
  if (typeof window === "undefined") return { id: null, source: "telegram_no_id" }
  const tg = (window as TgWindow).Telegram?.WebApp
  try {
    tg?.ready?.()
  } catch {
    // no-op
  }

  const directId = tg?.initDataUnsafe?.user?.id
  if (directId != null) {
    return {
      id: String(directId),
      source: "telegram",
    }
  }

  const parsedFromInitData = parseUserIdFromInitData(tg?.initData)
  if (parsedFromInitData) {
    return {
      id: parsedFromInitData,
      source: "telegram",
    }
  }

  const parsedFromUrl = parseUserIdFromUrl()
  if (parsedFromUrl) {
    return {
      id: parsedFromUrl,
      source: "telegram",
    }
  }

  if (isTelegramContext()) {
    return {
      id: null,
      source: "telegram_no_id",
    }
  }

  let localId = localStorage.getItem("local_user_id")
  if (!localId) {
    localId = crypto.randomUUID()
    localStorage.setItem("local_user_id", localId)
  }

  return {
    id: localId,
    source: "local",
  }
}

async function resolveStrictIdentity(attempts = 60, delayMs = 150): Promise<StrictIdentity> {
  if (typeof window !== "undefined") {
    const cached = sessionStorage.getItem("telegram_uid_resolved")
    if (cached) return { id: cached, source: "telegram" }
  }

  for (let i = 0; i < attempts; i += 1) {
    const identity = getUserIdStrict()
    if (identity.source !== "telegram_no_id" && identity.id) return identity

    const signedUid = await resolveSignedUidFromServer()
    if (signedUid) {
      sessionStorage.setItem("telegram_uid_resolved", signedUid)
      return { id: signedUid, source: "telegram" }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }

  const fallback = getUserIdStrict()
  if (fallback.source === "telegram_no_id") {
    const signedUid = await resolveSignedUidFromServer()
    if (signedUid) {
      sessionStorage.setItem("telegram_uid_resolved", signedUid)
      return { id: signedUid, source: "telegram" }
    }
  }
  return fallback
}

async function getOrCreateUserId() {
  const identity = await resolveStrictIdentity()
  if (!identity.id) throw new Error("Telegram user id is not available")
  return identity.id
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
  const [identityDiagnostics, setIdentityDiagnostics] = useState<string>("")
  const [identitySource, setIdentitySource] = useState<StrictIdentity["source"]>("local")

  useEffect(() => {
    const savedTab = localStorage.getItem("tab")
    if (savedTab === "today" || savedTab === "stats") setTab(savedTab)
  }, [])

  useEffect(() => {
    localStorage.setItem("tab", tab)
  }, [tab])

  const pretty = (n: number) => n.toLocaleString("en-US")

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
      .select("id,name,target_reps,sort_order,catalog_exercise_id")
      .eq("program_day_id", pd.id)
      .order("sort_order")

    if (exerr) {
      setDbg("ERROR day_exercises: " + exerr.message)
      setExercises([])
      setProgress({})
      return
    }
    exList = (exs as Exercise[]) ?? []

    const catalogIds = Array.from(
      new Set(
        exList
          .map((x) => x.catalog_exercise_id)
          .filter((x): x is number => x != null)
      )
    )
    if (catalogIds.length > 0) {
      const { data: catalogRows } = await supabase
        .from("exercise_catalog")
        .select("id,unit")
        .in("id", catalogIds)

      if (catalogRows?.length) {
        const unitMap = new Map<number, "reps" | "steps">(
          catalogRows.map((r) => [r.id as number, (r.unit === "steps" ? "steps" : "reps") as "reps" | "steps"])
        )
        exList = exList.map((row) => ({
          ...row,
          unit: row.catalog_exercise_id != null ? unitMap.get(row.catalog_exercise_id) : undefined,
        }))
      }
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
      const identity = await resolveStrictIdentity()
      setIdentitySource(identity.source)
      const debugEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1"
      setIdentityDebug(debugEnabled ? `uid: ${identity.id ?? "null"} (source: ${identity.source})` : "")
      if (debugEnabled || identity.source === "telegram_no_id") {
        const diagnostics = getIdentityDiagnostics()
        setIdentityDiagnostics(JSON.stringify(diagnostics, null, 2))
      } else {
        setIdentityDiagnostics("")
      }

      if (identity.source === "telegram_no_id" || !identity.id) {
        setLoading(false)
        setIsLoadingProgram(false)
        return
      }

      const uid = identity.id
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
    exercises: BuilderExercise[]
  }) => {
    const uid = await getOrCreateUserId()
    const programName = payload.name.trim()
    const exList = payload.exercises
      .map((x) => ({
        catalogExerciseId: x.catalogExerciseId,
        name: x.name.trim(),
        target: Math.max(1, Number(x.target) || 0),
        unit: x.unit,
        weight: Number.isFinite(Number(x.weight)) ? Number(x.weight) : null,
      }))
      .filter((x) => x.name.length > 0)

    if (!programName) return { ok: false, error: "Enter program name" }
    if (exList.length === 0) return { ok: false, error: "Add at least one exercise" }

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
        const message = body?.error ?? "Could not create program"
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
      const message = e instanceof Error ? e.message : "Unknown error"
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
        if (err1) return { ok: false, error: err1.message ?? "Update failed" }
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
        if (err1) return { ok: false, error: err1.message ?? "Update failed" }
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
    const steps = entries.reduce((s, [name, v]) => s + (/step/i.test(name) ? v : 0), 0)
    const others = entries.reduce((s, [name, v]) => s + (/step/i.test(name) ? 0 : v), 0)
    return { steps, others }
  }, [historyByExercise])

  const stats = useMemo(() => {
    const totalDays = history.length
    const totalReps = history.reduce((s, h) => s + h.totalDone, 0)
    const { current } = computeStreaks(history)
    const last7 = [...history].sort((a, b) => (a.date > b.date ? -1 : 1)).slice(0, 7)
    return { totalDays, totalReps, streak: current, last7 }
  }, [history])

  if (identitySource === "telegram_no_id") {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <div className="text-2xl font-semibold tracking-tight">Open inside Telegram</div>
          <div className="mt-2 text-sm text-neutral-400">This app must be opened from Telegram bot.</div>
          <div className="mt-3 text-[11px] text-neutral-500">source: {identitySource}</div>
          {identityDiagnostics ? (
            <pre className="mt-3 max-h-56 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-[10px] leading-relaxed text-neutral-300">
              {identityDiagnostics}
            </pre>
          ) : null}
        </div>
      </div>
    )
  }

  if (loading || isLoadingProgram) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center">
        <div className="text-sm text-neutral-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
    
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-indigo-500/10 via-fuchsia-500/5 to-transparent" />

      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-6 pb-24">
        {identityDebug ? <div className="mb-2 text-[11px] text-neutral-500">{identityDebug}</div> : null}
        {identityDiagnostics ? (
          <pre className="mb-3 overflow-auto rounded-2xl border border-white/10 bg-white/5 p-3 text-[10px] leading-relaxed text-neutral-300">
            {identityDiagnostics}
          </pre>
        ) : null}
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

              await supabase.from("user_exercise_progress").delete().eq("user_id", uid)
              if (programId != null) {
                await supabase.from("user_day_history").delete().eq("user_id", uid).eq("program_id", programId)
                await supabase.from("user_day_history_exercises").delete().eq("user_id", uid).eq("program_id", programId)
              }

              const { data: updatedRows, error: updateErr } = await supabase
                .from("user_state")
                .update({ program_id: null, current_day: 1, updated_at: new Date().toISOString() })
                .eq("user_id", uid)
                .select("user_id")
                .limit(1)

              if (updateErr) {
                setDbg("ERROR reset user_state: " + updateErr.message)
              } else if (!updatedRows || updatedRows.length === 0) {
                const { error: insertStateErr } = await supabase
                  .from("user_state")
                  .insert({ user_id: uid, program_id: null, current_day: 1 })
                if (insertStateErr) {
                  setDbg("ERROR reset user_state insert: " + insertStateErr.message)
                }
              }

              localStorage.removeItem("tab")
              localStorage.removeItem("onboarding_dismissed")
              sessionStorage.removeItem("telegram_uid_resolved")
              sessionStorage.removeItem("tg_context")

              setDay(1)
              setProgramId(null)
              setShowProgramMenu(true)
              setShowCustomBuilder(false)
              setExercises([])
              setProgress({})
              setCustomInput({})
              setHistory([])
              setHistoryByExercise({})
              setTab("today")

              setDbg("RESET OK")
            }}
          />
        )}
      </div>

      {programId == null ? null : <TabBar tab={tab} setTab={setTab} />}
    </div>
  )
}
