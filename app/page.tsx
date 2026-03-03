"use client"
import { useEffect, useMemo, useState } from "react"
import { supabase } from "./lib/supabase"
import type { Exercise, HistoryEntry } from "./components/types"
import ProgramPicker from "./components/ProgramPicker"
import CustomProgramBuilder from "./components/CustomProgramBuilder"
import type { BuilderExercise } from "./components/CustomProgramBuilder"
import TodayView from "./components/TodayView"
import StatsView from "./components/StatsView"
import LeaderboardView from "./components/LeaderboardView"
import TabBar from "./components/TabBar"
import { clamp, computeStreaks, localISODate } from "./lib/date"
import { loadExerciseCatalog } from "./lib/catalog"
const PRESET_PROGRAM_META: Record<
  string,
  { titleRu: string; titleEn: string; descriptionRu: string; descriptionEn: string }
> = {
  "100 days Advanced": {
    titleRu: "100 days Advanced",
    titleEn: "100 days Advanced",
    descriptionRu:
      "Эта программа представляет из себя чередующиеся 2 тренировки на протяжении 100 дней:\n• День A: отжимания двух типов, подтягивания и шаги\n• День B: пресс, приседания и шаги\nИ так по кругу, 100 дней.",
    descriptionEn:
      "This program alternates two workouts for 100 days:\n• Day A: two push-up types, pull-ups, and steps\n• Day B: abs, squats, and steps\nRepeat this cycle for 100 days.",
  },
  "Самая база — 100 отжиманий": {
    titleRu: "Самая база — 100 отжиманий",
    titleEn: "Basic - 100 push-ups",
    descriptionRu: "Базовая программа на 100 дней с акцентом на отжимания.",
    descriptionEn: "A basic 100-day program focused on push-ups.",
  },
  "100 отжиманий + 50 подтягиваний": {
    titleRu: "100 отжиманий + 50 подтягиваний",
    titleEn: "100 push-ups + 50 pull-ups",
    descriptionRu: "Силовая программа на 100 дней: отжимания и подтягивания каждый день.",
    descriptionEn: "A 100-day strength program with daily push-ups and pull-ups.",
  },
  "100 отжиманий через день": {
    titleRu: "100 отжиманий через день",
    titleEn: "100 push-ups every other day",
    descriptionRu: "Программа на 100 дней в режиме через день для комфортного восстановления.",
    descriptionEn: "A 100-day every-other-day plan for better recovery.",
  },
}
type Lang = "ru" | "en"
const I18N: Record<
  Lang,
  {
    tabToday: string
    tabStats: string
    tabLeaderboard: string
    leaderboardTitle: string
    totalStar: string
    chooseName: string
    save: string
    globalLeaderboard: string
    loadingLeaderboard: string
    noData: string
    welcome: string
    builtInSubtitle: string
    createOwn: string
    customSubtitle: string
    confirmTitle: string
    confirmBody: string
    confirmOk: string
    confirmBack: string
    openInsideTitle: string
    openInsideBody: string
    loading: string
  }
> = {
  ru: {
    tabToday: "Сегодня",
    tabStats: "Статистика",
    tabLeaderboard: "Лидерборд",
    leaderboardTitle: "Лидерборд",
    totalStar: "Всего ★",
    chooseName: "Выбери имя в лидерборде",
    save: "Сохранить",
    globalLeaderboard: "Глобальный лидерборд",
    loadingLeaderboard: "Загрузка лидерборда...",
    noData: "Пока нет данных.",
    welcome: "Добро пожаловать! Выбери готовую программу или создай свою",
    builtInSubtitle: "Встроенная программа",
    createOwn: "Создать свою",
    customSubtitle: "Твой кастомный план тренировок",
    confirmTitle: "Чередование + шаги",
    confirmBody:
      "Эта программа представляет из себя чередующиеся 2 тренировки на протяжении 100 дней:\n• День A: отжимания двух типов, подтягивания и шаги\n• День B: пресс, приседания и шаги\nИ так по кругу, 100 дней.",
    confirmOk: "Ок",
    confirmBack: "Назад",
    openInsideTitle: "Открой внутри Telegram",
    openInsideBody: "Это приложение нужно открывать из Telegram-бота.",
    loading: "Загрузка...",
  },
  en: {
    tabToday: "Today",
    tabStats: "Stats",
    tabLeaderboard: "Leaderboard",
    leaderboardTitle: "Leaderboard",
    totalStar: "Total ★",
    chooseName: "Choose your leaderboard name",
    save: "Save",
    globalLeaderboard: "Global leaderboard",
    loadingLeaderboard: "Loading leaderboard...",
    noData: "No data yet.",
    welcome: "Welcome! Choose a ready program or create your own",
    builtInSubtitle: "Built-in program",
    createOwn: "Create your own",
    customSubtitle: "Your custom workout plan",
    confirmTitle: "Alternation + steps",
    confirmBody:
      "This program alternates two workouts for 100 days:\n• Day A: two push-up types, pull-ups, and steps\n• Day B: abs, squats, and steps\nRepeat this cycle for 100 days.",
    confirmOk: "OK",
    confirmBack: "Back",
    openInsideTitle: "Open inside Telegram",
    openInsideBody: "This app must be opened from Telegram bot.",
    loading: "Loading...",
  },
}

type TgWindow = Window & {
  Telegram?: {
    WebApp?: {
      initData?: string
      initDataUnsafe?: {
        user?: {
          id?: number | string
          username?: string
          first_name?: string
          last_name?: string
          language_code?: string
        }
      }
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

async function persistTelegramProfile(internalUserId: string, debugEnabled: boolean) {
  if (typeof window === "undefined") return
  const tgUser = (window as TgWindow).Telegram?.WebApp?.initDataUnsafe?.user
  if (!tgUser?.id) return

  const telegramId = String(tgUser.id)
  const username = tgUser.username ?? null
  const firstName = tgUser.first_name ?? null
  const lastName = tgUser.last_name ?? null
  const languageCode = tgUser.language_code ?? null
  const now = new Date().toISOString()

  const attempts: Array<{ payload: Record<string, unknown>; onConflict: string }> = [
    {
      payload: {
        user_id: internalUserId,
        telegram_id: telegramId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        language_code: languageCode,
        updated_at: now,
      },
      onConflict: "user_id",
    },
    {
      payload: {
        user_id: internalUserId,
        telegram_id: telegramId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        language_code: languageCode,
        updated_at: now,
      },
      onConflict: "telegram_id",
    },
    {
      payload: {
        user_id: internalUserId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        updated_at: now,
      },
      onConflict: "user_id",
    },
  ]

  let lastError: string | null = null
  for (const attempt of attempts) {
    const { error } = await supabase
      .from("telegram_users")
      .upsert(attempt.payload, { onConflict: attempt.onConflict })
    if (!error) return
    lastError = error.message
  }

  if (debugEnabled && lastError) {
    console.error("telegram profile upsert failed:", lastError)
  }
}

export default function Home() {
  const [dbg, setDbg] = useState<string>("")
  const [tab, setTab] = useState<"today" | "stats" | "leaderboard">("today")
  const [lang, setLang] = useState<Lang>("ru")

  const [loading, setLoading] = useState(true)
  const [programId, setProgramId] = useState<string | number | null>(null)
  const [isLoadingProgram, setIsLoadingProgram] = useState(true)
  const [showProgramMenu, setShowProgramMenu] = useState(true)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [presetProgramRows, setPresetProgramRows] = useState<Array<{ id: string | number; name: string }>>([])

  const [day, setDay] = useState(1)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [customInput, setCustomInput] = useState<Record<string, string>>({})

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, number>>({})
  const [myTotalStars, setMyTotalStars] = useState(0)
  const [leaderboardRows, setLeaderboardRows] = useState<
    Array<{ rank: number; userId: string; label: string; totalStars: number }>
  >([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [catalogMetaById, setCatalogMetaById] = useState<
    Record<number, { weight: number; unit: string; defaultTarget: number; label: string }>
  >({})
  const [showLeaderboardNameForm, setShowLeaderboardNameForm] = useState(false)
  const [leaderboardDisplayName, setLeaderboardDisplayName] = useState("")
  const [leaderboardDisplayNameSaving, setLeaderboardDisplayNameSaving] = useState(false)
  const [leaderboardDisplayNameError, setLeaderboardDisplayNameError] = useState<string | null>(null)
  const [identityDebug, setIdentityDebug] = useState<string>("")
  const [identityDiagnostics, setIdentityDiagnostics] = useState<string>("")
  const [identitySource, setIdentitySource] = useState<StrictIdentity["source"]>("local")

  useEffect(() => {
    const stored = localStorage.getItem("lang")
    if (stored === "ru" || stored === "en") setLang(stored)
  }, [])

  useEffect(() => {
    localStorage.setItem("lang", lang)
  }, [lang])

  useEffect(() => {
    const savedTab = localStorage.getItem("tab")
    if (savedTab === "today" || savedTab === "stats" || savedTab === "leaderboard") setTab(savedTab)
  }, [])

  useEffect(() => {
    localStorage.setItem("tab", tab)
  }, [tab])

  useEffect(() => {
    const run = async () => {
      if (!showProgramMenu) return
      await loadPresetPrograms()
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showProgramMenu])

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

  const ensureCatalogMeta = async () => {
    if (Object.keys(catalogMetaById).length > 0) return catalogMetaById
    const result = await loadExerciseCatalog()
    if (result.error) throw new Error(result.error)
    const map: Record<number, { weight: number; unit: string; defaultTarget: number; label: string }> = {}
    result.data.forEach((item) => {
      map[item.id] = {
        weight: Number(item.weight) || 1,
        unit: item.unit,
        defaultTarget: Number(item.default_target) || 0,
        label: item.label,
      }
    })
    setCatalogMetaById(map)
    return map
  }

  const computeTotalStarsByUsers = async (userIds: string[]) => {
    const { data: catalogRows, error: catalogErr } = await supabase
      .from("exercise_catalog")
      .select("id,weight,label")
      .eq("is_active", true)
    if (catalogErr) throw new Error(catalogErr.message)
    const weightByCatalogId = new Map<number, number>()
    const weightByName = new Map<string, number>()
    const catalogIdByName = new Map<string, number>()
    ;(catalogRows ?? []).forEach((r) => {
      const id = Number(r.id)
      const weight = Number(r.weight)
      if (Number.isFinite(id)) weightByCatalogId.set(id, weight)
      const label = String((r as { label?: string | null }).label ?? "").trim().toLowerCase()
      if (label) {
        weightByName.set(label, weight)
        catalogIdByName.set(label, id)
      }
    })

    const totals = new Map<string, number>()
    userIds.forEach((id) => totals.set(id, 0))
    if (userIds.length === 0) return totals

    type BreakdownRow = {
      id?: string | null
      user_id?: string | null
      reps_done?: number | null
      catalog_exercise_id?: number | null
      day_exercise_id?: string | null
      exercise_name?: string | null
    }
    let breakdownRows: BreakdownRow[] = []
    const repsQueryWithDayExercise = await supabase
      .from("user_day_history_exercises")
      .select("id,user_id,reps_done,catalog_exercise_id,day_exercise_id,exercise_name")
      .in("user_id", userIds)
    if (repsQueryWithDayExercise.error) {
      const repsQuery = await supabase
        .from("user_day_history_exercises")
        .select("id,user_id,reps_done,catalog_exercise_id,exercise_name")
        .in("user_id", userIds)
      if (repsQuery.error) throw new Error(repsQuery.error.message)
      breakdownRows = (repsQuery.data as BreakdownRow[]) ?? []
    } else {
      breakdownRows = (repsQueryWithDayExercise.data as BreakdownRow[]) ?? []
    }

    const dayExerciseIds = Array.from(
      new Set(
        breakdownRows
          .filter((r) => (r.catalog_exercise_id == null || !Number.isFinite(Number(r.catalog_exercise_id))) && r.day_exercise_id)
          .map((r) => String(r.day_exercise_id))
      )
    )
    const dayCatalogMap = new Map<string, number>()
    if (dayExerciseIds.length > 0) {
      const { data: dayRows, error: dayErr } = await supabase
        .from("day_exercises")
        .select("id,catalog_exercise_id")
        .in("id", dayExerciseIds)
      if (!dayErr) {
        ;(dayRows ?? []).forEach((r) => {
          const cid = Number((r as { catalog_exercise_id?: number | null }).catalog_exercise_id)
          if (Number.isFinite(cid)) dayCatalogMap.set(String(r.id), cid)
        })
      }
    }

    const historyCatalogBackfill: Array<{ id: string; catalogId: number }> = []
    breakdownRows.forEach((row) => {
      const userId = String(row.user_id ?? "")
      if (!userId || !totals.has(userId)) return
      const done = Number(row.reps_done) || 0
      if (done <= 0) return

      let catalogId = Number(row.catalog_exercise_id)
      if (!Number.isFinite(catalogId) && row.day_exercise_id) {
        catalogId = Number(dayCatalogMap.get(String(row.day_exercise_id)))
      }
      if (!Number.isFinite(catalogId)) {
        const exName = String(row.exercise_name ?? "").trim().toLowerCase()
        catalogId = Number(catalogIdByName.get(exName))
      }
      if (Number.isFinite(catalogId) && row.catalog_exercise_id == null && row.id) {
        historyCatalogBackfill.push({ id: String(row.id), catalogId: Number(catalogId) })
      }
      let weight = Number.isFinite(catalogId) ? Number(weightByCatalogId.get(catalogId)) : NaN
      if (!Number.isFinite(weight) || weight <= 0) {
        const exName = String(row.exercise_name ?? "").trim().toLowerCase()
        weight = Number(weightByName.get(exName))
      }
      if (!Number.isFinite(weight) || weight <= 0) return

      const stars = Math.floor(done / weight)
      totals.set(userId, (totals.get(userId) ?? 0) + stars)
    })

    if (historyCatalogBackfill.length > 0) {
      await Promise.all(
        historyCatalogBackfill.map((item) =>
          supabase.from("user_day_history_exercises").update({ catalog_exercise_id: item.catalogId }).eq("id", item.id)
        )
      )
    }

    return totals
  }

  const loadLeaderboard = async (uid: string) => {
    setLeaderboardLoading(true)
    setLeaderboardError(null)
    setLeaderboardDisplayNameError(null)
    try {
      const { data: stateRows, error: stateErr } = await supabase.from("user_state").select("user_id")
      if (stateErr) throw new Error(stateErr.message)
      const userIds = Array.from(new Set((stateRows ?? []).map((r) => String(r.user_id)).filter(Boolean)))

      if (userIds.length === 0) {
        setLeaderboardRows([])
        setShowLeaderboardNameForm(false)
        setLeaderboardLoading(false)
        return
      }

      const { data: tgRows, error: tgErr } = await supabase
        .from("telegram_users")
        .select("user_id,username,first_name,display_name")
        .in("user_id", userIds)
      let safeTgRows: Array<{ user_id: string; username?: string | null; first_name?: string | null; display_name?: string | null }> =
        (tgRows as Array<{ user_id: string; username?: string | null; first_name?: string | null; display_name?: string | null }>) ?? []
      let displayNameColumnMissing = false
      if (tgErr) {
        const msg = tgErr.message || ""
        if (msg.includes("display_name")) {
          displayNameColumnMissing = true
          setLeaderboardDisplayNameError("display_name column missing")
          const fallback = await supabase
            .from("telegram_users")
            .select("user_id,username,first_name")
            .in("user_id", userIds)
          if (fallback.error) throw new Error(fallback.error.message)
          safeTgRows =
            (fallback.data as Array<{ user_id: string; username?: string | null; first_name?: string | null }>) ?? []
        } else {
          throw new Error(msg)
        }
      }
      const displayNameMap = new Map<string, string>()
      let currentUserDisplayName: string | null = null
      safeTgRows?.forEach((r) => {
        const key = String(r.user_id)
        const displayName = typeof r.display_name === "string" ? r.display_name.trim() : ""
        if (key === uid) currentUserDisplayName = displayName || null
        if (displayName) {
          displayNameMap.set(key, displayName)
          return
        }
        if (r.username) {
          displayNameMap.set(key, `@${r.username}`)
          return
        }
        if (r.first_name) {
          displayNameMap.set(key, String(r.first_name))
        }
      })
      setShowLeaderboardNameForm(displayNameColumnMissing ? true : !currentUserDisplayName)
      if (currentUserDisplayName) setLeaderboardDisplayName(currentUserDisplayName)

      const totalsByUser = await computeTotalStarsByUsers(userIds)
      setMyTotalStars(totalsByUser.get(uid) ?? 0)
      const totalPairs = userIds.map((userId) => ({ userId, totalStars: totalsByUser.get(userId) ?? 0 }))
      const sorted = totalPairs.sort((a, b) => b.totalStars - a.totalStars).slice(0, 20)
      const rows = sorted.map((item, idx) => {
        const label =
          displayNameMap.get(item.userId) ??
          (lang === "ru" ? `Пользователь ${item.userId.slice(-4)}` : `User ${item.userId.slice(-4)}`)
        return {
          rank: idx + 1,
          userId: item.userId,
          label,
          totalStars: item.totalStars,
        }
      })
      setLeaderboardRows(rows)
    } catch (e) {
      setLeaderboardError(e instanceof Error ? e.message : lang === "ru" ? "Неизвестная ошибка" : "Unknown error")
    }
    setLeaderboardLoading(false)
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

    const catalogMap = await ensureCatalogMeta()
    const catalogIdByLabel = new Map<string, number>()
    Object.entries(catalogMap).forEach(([id, meta]) => {
      catalogIdByLabel.set(meta.label.trim().toLowerCase(), Number(id))
    })

    const missingCatalogUpdates: Array<{ id: string; catalogId: number }> = []

    exList = exList.map((row) => {
      let resolvedCatalogId = row.catalog_exercise_id ?? null
      if (resolvedCatalogId == null) {
        const byNameId = catalogIdByLabel.get(String(row.name ?? "").trim().toLowerCase())
        if (Number.isFinite(Number(byNameId))) {
          resolvedCatalogId = Number(byNameId)
          missingCatalogUpdates.push({ id: row.id, catalogId: Number(byNameId) })
        }
      }
      return {
        ...row,
        catalog_exercise_id: resolvedCatalogId,
        unit: resolvedCatalogId != null ? catalogMap[resolvedCatalogId]?.unit : undefined,
        weight: resolvedCatalogId != null ? catalogMap[resolvedCatalogId]?.weight : null,
        default_target: resolvedCatalogId != null ? catalogMap[resolvedCatalogId]?.defaultTarget : null,
      }
    })

    if (missingCatalogUpdates.length > 0) {
      await Promise.all(
        missingCatalogUpdates.map((item) =>
          supabase.from("day_exercises").update({ catalog_exercise_id: item.catalogId }).eq("id", item.id)
        )
      )
    }
    setExercises(exList)

    if (exList.length === 0) {
      setProgress({})
      return
    }

    const ids = exList.map((x) => x.id)
    const today = localISODate()
    const { data: progDone, error: prerrDone } = await supabase
      .from("user_exercise_progress")
      .select("day_exercise_id,done")
      .eq("user_id", uid)
      .eq("local_date", today)
      .in("day_exercise_id", ids)

    const map: Record<string, number> = {}
    if (!prerrDone && progDone) {
      progDone.forEach((p) => {
        map[String(p.day_exercise_id)] = Number(p.done) || 0
      })
      setProgress(map)
      return
    }

    const { data: progReps, error: prerrReps } = await supabase
      .from("user_exercise_progress")
      .select("day_exercise_id,reps_done")
      .eq("user_id", uid)
      .in("day_exercise_id", ids)

    if (prerrReps) {
      setDbg("ERROR progress load: " + prerrReps.message)
      setProgress({})
      return
    }

    progReps?.forEach((p) => {
      map[String(p.day_exercise_id)] = Number(p.reps_done) || 0
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
      await persistTelegramProfile(uid, debugEnabled)
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
        await loadPresetPrograms()
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
        await loadPresetPrograms()
        setLoading(false)
        setIsLoadingProgram(false)
        return
      }

      await loadDay(uid, selectedProgramId, currentDay)
      await fetchHistory(uid, selectedProgramId)
      await fetchHistoryBreakdown(uid, selectedProgramId)
      await loadLeaderboard(uid)

      setDbg(`OK: day ${currentDay}`)
      setLoading(false)
      setIsLoadingProgram(false)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const run = async () => {
      if (tab !== "leaderboard") return
      try {
        const uid = await getOrCreateUserId()
        await loadLeaderboard(uid)
      } catch (e) {
      setLeaderboardError(e instanceof Error ? e.message : lang === "ru" ? "Неизвестная ошибка" : "Unknown error")
      }
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, programId])

  const saveLeaderboardDisplayName = async () => {
    const uid = await getOrCreateUserId()
    const value = leaderboardDisplayName.trim()
    if (!value) {
      setLeaderboardDisplayNameError(lang === "ru" ? "Имя обязательно" : "Name is required")
      return
    }
    if (value.length > 20) {
      setLeaderboardDisplayNameError("Max 20 characters")
      return
    }

    setLeaderboardDisplayNameSaving(true)
    setLeaderboardDisplayNameError(null)
    const now = new Date().toISOString()
    const tgId = (window as TgWindow).Telegram?.WebApp?.initDataUnsafe?.user?.id
    const chatId = tgId != null ? String(tgId) : uid

    const { error } = await supabase
      .from("telegram_users")
      .upsert({ user_id: uid, chat_id: chatId, display_name: value, updated_at: now }, { onConflict: "user_id" })
    if (error) {
      const message = error.message?.includes("display_name") ? "display_name column missing" : error.message
      setLeaderboardDisplayNameError(message)
      setLeaderboardDisplayNameSaving(false)
      return
    }

    setShowLeaderboardNameForm(false)
    setLeaderboardDisplayNameSaving(false)
    await loadLeaderboard(uid)
  }

  const loadPresetPrograms = async () => {
    const { data, error } = await supabase
      .from("programs")
      .select("id,name,created_at,is_public")
      .eq("is_public", true)
      .order("created_at", { ascending: true })

    if (error) {
      setDbg("ERROR programs load: " + error.message)
      console.error("programs load failed:", error.message)
      setPresetProgramRows([])
      return
    }
    setPresetProgramRows(
      (data ?? []).map((row) => ({
        id: row.id,
        name: String(row.name ?? ""),
      }))
    )
  }

  const chooseBuiltInProgram = async (pickedProgramId?: string | number) => {
    const uid = await getOrCreateUserId()
    setIsLoadingProgram(true)

    let selectedProgramId: string | number | null = pickedProgramId ?? null
    const startDay = 1

    if (selectedProgramId == null) {
      const { data: anyPublic, error: anyPublicErr } = await supabase
        .from("programs")
        .select("id")
        .eq("is_public", true)
        .order("created_at", { ascending: true })
        .limit(50)

      if (!anyPublicErr && anyPublic?.length) {
        for (const row of anyPublic) {
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

    if (!programName) return { ok: false, error: lang === "ru" ? "Введите название программы" : "Enter program name" }
    if (exList.length === 0) return { ok: false, error: lang === "ru" ? "Добавьте хотя бы одно упражнение" : "Add at least one exercise" }

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
        const message = body?.error ?? (lang === "ru" ? "Не удалось создать программу" : "Could not create program")
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
      const message = e instanceof Error ? e.message : lang === "ru" ? "Неизвестная ошибка" : "Unknown error"
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

    const entryDate = localISODate()
    const { error } = await supabase
      .from("user_exercise_progress")
      .upsert(
        { user_id: uid, local_date: entryDate, day_exercise_id: id, done: updated },
        { onConflict: "user_id,day_exercise_id,local_date" }
      )

    if (!error) {
      setDbg((prev) => (prev.startsWith("ERROR save progress:") ? "" : prev))
      return
    }

    const { error: retryUpsertErr } = await supabase
      .from("user_exercise_progress")
      .upsert(
        { user_id: uid, local_date: entryDate, day_exercise_id: id, done: updated },
        { onConflict: "user_id,day_exercise_id,local_date" }
      )
    if (!retryUpsertErr) {
      setDbg((prev) => (prev.startsWith("ERROR save progress:") ? "" : prev))
      return
    }

    const { error: fallbackErr } = await supabase
      .from("user_exercise_progress")
      .delete()
      .eq("user_id", uid)
      .eq("day_exercise_id", id)
    if (!fallbackErr) {
      const { error: insertErr } = await supabase
        .from("user_exercise_progress")
        .insert({ user_id: uid, local_date: entryDate, day_exercise_id: id, done: updated })
      if (!insertErr) {
        setDbg((prev) => (prev.startsWith("ERROR save progress:") ? "" : prev))
        return
      }
      const { error: retryInsertErr } = await supabase
        .from("user_exercise_progress")
        .insert({ user_id: uid, local_date: entryDate, day_exercise_id: id, done: updated })
      if (!retryInsertErr) {
        setDbg((prev) => (prev.startsWith("ERROR save progress:") ? "" : prev))
        return
      }
      if (!retryInsertErr.message?.includes("user_exercise_progress_pkey")) {
        setDbg("ERROR save progress: " + retryInsertErr.message)
      }
      return
    }
    if (!retryUpsertErr.message?.includes("user_exercise_progress_pkey")) {
      setDbg("ERROR save progress: " + retryUpsertErr.message)
    }
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
    catalogExerciseId: number | null
    applyTo: "today" | "program"
  }): Promise<{ ok: boolean; error?: string }> => {
    if (programId == null) return { ok: false, error: lang === "ru" ? "Программа не выбрана" : "Program is not selected" }
    const trimmedName = payload.name.trim()
    const safeTarget = Math.max(1, Number(payload.target) || 0)
    const safeCatalogId =
      payload.catalogExerciseId != null && Number.isFinite(Number(payload.catalogExerciseId))
        ? Number(payload.catalogExerciseId)
        : null
    if (!trimmedName) return { ok: false, error: lang === "ru" ? "Название обязательно" : "Name is required" }

    try {
      if (payload.applyTo === "today") {
        const { error: err1 } = await supabase
          .from("day_exercises")
          .update({ name: trimmedName, target_reps: safeTarget, catalog_exercise_id: safeCatalogId })
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
          .update({ name: trimmedName, target_reps: safeTarget, catalog_exercise_id: safeCatalogId })
          .in("program_day_id", dayIds)
          .eq("name", payload.originalName)
        if (err1) return { ok: false, error: err1.message ?? "Update failed" }
      }

      const uid = await getOrCreateUserId()
      await loadDay(uid, programId, day)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : lang === "ru" ? "Неизвестная ошибка" : "Unknown error" }
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
    const { error: herr } = await supabase.from("user_day_history").upsert(
      {
        user_id: uid,
        program_id: programId,
        day_number: day,
        local_date: entryDate,
        total_done: totalDone,
        total_target: totalTarget,
        skipped: force,
      },
      { onConflict: "user_id,program_id,day_number" }
    )

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
      day_exercise_id: ex.id,
      catalog_exercise_id: ex.catalog_exercise_id ?? null,
    }))

    const { error: berr } = await supabase
      .from("user_day_history_exercises")
      .upsert(breakdownRows, { onConflict: "user_id,program_id,day_number,exercise_name" })
    if (berr) {
      const legacyBreakdownRows = exercises.map((ex) => ({
        user_id: uid,
        program_id: programId,
        day_number: day,
        local_date: entryDate,
        exercise_name: ex.name,
        reps_done: progress[ex.id] || 0,
        reps_target: ex.target_reps,
      }))
      const { error: legacyUpsertErr } = await supabase
        .from("user_day_history_exercises")
        .upsert(legacyBreakdownRows, { onConflict: "user_id,program_id,day_number,exercise_name" })
      if (!legacyUpsertErr) {
        // continue next day flow with legacy schema
      } else {
        const { error: bdelErr } = await supabase
          .from("user_day_history_exercises")
          .delete()
          .eq("user_id", uid)
          .eq("program_id", programId)
          .eq("day_number", day)
        if (bdelErr) {
          setDbg("ERROR breakdown save: " + legacyUpsertErr.message)
          return
        }
        const { error: binsErr } = await supabase.from("user_day_history_exercises").insert(legacyBreakdownRows)
        if (binsErr) {
          setDbg("ERROR breakdown save: " + binsErr.message)
          return
        }
      }
    }

    const progressRows = exercises.map((ex) => ({
      user_id: uid,
      local_date: entryDate,
      day_exercise_id: ex.id,
      done: progress[ex.id] || 0,
    }))
    const { error: pdelErr } = await supabase
      .from("user_exercise_progress")
      .delete()
      .eq("user_id", uid)
      .eq("local_date", entryDate)
    if (pdelErr) {
      setDbg("ERROR ★ delete: " + pdelErr.message)
      return
    }
    const { error: pinsErr } = await supabase
      .from("user_exercise_progress")
      .upsert(progressRows, { onConflict: "user_id,day_exercise_id,local_date" })
    if (pinsErr) {
      const dayExerciseIds = exercises.map((ex) => ex.id)
      const { error: pdelErr2 } = await supabase
        .from("user_exercise_progress")
        .delete()
        .eq("user_id", uid)
        .in("day_exercise_id", dayExerciseIds)
      if (pdelErr2) {
        setDbg("ERROR ★ save: " + pdelErr2.message)
        return
      }
      const { error: pinsErr2 } = await supabase.from("user_exercise_progress").insert(progressRows)
      if (pinsErr2) {
        if (pinsErr2.message?.includes("user_exercise_progress_pkey")) {
          const { error: pinsErr3 } = await supabase.from("user_exercise_progress").insert(progressRows)
          if (pinsErr3) {
            setDbg("ERROR ★ save: " + pinsErr3.message)
            return
          }
        } else {
          setDbg("ERROR ★ save: " + pinsErr2.message)
          return
        }
      }
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

    // 3) move to next day + load
    const next = day + 1
    setDay(next)
    setProgress({})
    setCustomInput({})
    setTab("stats")

    await loadDay(uid, programId, next)
    await fetchHistory(uid, programId)
    await fetchHistoryBreakdown(uid, programId)
    await loadLeaderboard(uid)

    setDbg(`OK: preset, day ${next}`)
  }

  const totalsSplit = useMemo(() => {
    const entries = Object.entries(historyByExercise)
    const steps = entries.reduce((s, [name, v]) => s + (/step/i.test(name) ? v : 0), 0)
    const others = entries.reduce((s, [name, v]) => s + (/step/i.test(name) ? 0 : v), 0)
    return { steps, others }
  }, [historyByExercise])

  const editCatalogOptions = useMemo(
    () =>
      Object.entries(catalogMetaById)
        .map(([id, meta]) => ({
          id: Number(id),
          label: meta.label,
          unit: meta.unit,
          defaultTarget: meta.defaultTarget,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [catalogMetaById]
  )

  const presetPrograms = useMemo(
    () =>
      presetProgramRows.map((row) => {
        const meta = PRESET_PROGRAM_META[row.name]
        return {
          id: row.id,
          title: lang === "ru" ? (meta?.titleRu ?? row.name) : (meta?.titleEn ?? row.name),
          description:
            lang === "ru"
              ? (meta?.descriptionRu ?? "Описание недоступно.")
              : (meta?.descriptionEn ?? "Description is unavailable."),
        }
      }),
    [presetProgramRows, lang]
  )

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
          <div className="text-2xl font-semibold tracking-tight">{I18N[lang].openInsideTitle}</div>
          <div className="mt-2 text-sm text-neutral-400">{I18N[lang].openInsideBody}</div>
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
        <div className="text-sm text-neutral-400">{I18N[lang].loading}</div>
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
            <CustomProgramBuilder onBack={() => setShowCustomBuilder(false)} onCreate={createCustomProgram} lang={lang} />
          ) : (
            <ProgramPicker
              onPickBuiltIn={chooseBuiltInProgram}
              onPickCustom={() => setShowCustomBuilder(true)}
              loading={isLoadingProgram}
              presets={presetPrograms}
              lang={lang}
              onLangChange={setLang}
              labels={{
                welcome: I18N[lang].welcome,
                builtInSubtitle: I18N[lang].builtInSubtitle,
                createOwn: I18N[lang].createOwn,
                customSubtitle: I18N[lang].customSubtitle,
                confirmTitle: I18N[lang].confirmTitle,
                confirmBody: I18N[lang].confirmBody,
                confirmOk: I18N[lang].confirmOk,
                confirmBack: I18N[lang].confirmBack,
              }}
            />
          )
        ) : tab === "today" ? (
          <TodayView
            lang={lang}
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
            catalogOptions={editCatalogOptions}
            editExercise={editExercise}
          />
        ) : tab === "stats" ? (
          <StatsView
          lang={lang}
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
              setMyTotalStars(0)
              setLeaderboardRows([])
              setShowLeaderboardNameForm(false)
              setLeaderboardDisplayName("")
              setLeaderboardDisplayNameError(null)
              setTab("today")

              setDbg("RESET OK")
            }}
          />
        ) : (
          <LeaderboardView
            myTotalStars={myTotalStars}
            rows={leaderboardRows}
            loading={leaderboardLoading}
            error={leaderboardError}
            showNameForm={showLeaderboardNameForm}
            displayName={leaderboardDisplayName}
            displayNameSaving={leaderboardDisplayNameSaving}
            displayNameError={leaderboardDisplayNameError}
            onDisplayNameChange={setLeaderboardDisplayName}
            onSaveDisplayName={saveLeaderboardDisplayName}
            labels={{
              leaderboard: I18N[lang].leaderboardTitle,
              totalStarTitle: I18N[lang].totalStar,
              chooseName: I18N[lang].chooseName,
              save: I18N[lang].save,
              global: I18N[lang].globalLeaderboard,
              loading: I18N[lang].loadingLeaderboard,
              noData: I18N[lang].noData,
            }}
          />
        )}
      </div>

      {programId == null ? null : (
        <TabBar
          tab={tab}
          setTab={setTab}
          labels={{
            today: I18N[lang].tabToday,
            stats: I18N[lang].tabStats,
            leaderboard: I18N[lang].tabLeaderboard,
          }}
        />
      )}
    </div>
  )
}

