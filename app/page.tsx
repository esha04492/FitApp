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
    howItWorks: string
    howItWorksTitle: string
    howItWorksBody: string
    examplesTitle: string
    ok: string
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
    welcome: "Выбери программу",
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
    howItWorks: "Как это работает?",
    howItWorksTitle: "Как начисляются звёзды",
    howItWorksBody:
      "Звёзды считаются по единому правилу: сколько сделал, столько получаешь по курсу упражнения. Для кастомных упражнений курс зависит от выбранной дневной нормы.",
    examplesTitle: "Примеры",
    ok: "Ок",
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
    welcome: "Choose a program",
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
    howItWorks: "How it works?",
    howItWorksTitle: "How stars are calculated",
    howItWorksBody:
      "Stars use one simple rule: your completed amount is converted by exercise rate. For custom exercises, rate is based on your daily target.",
    examplesTitle: "Examples",
    ok: "OK",
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
  const [lang, setLang] = useState<Lang>("en")

  const [loading, setLoading] = useState(true)
  const [programId, setProgramId] = useState<string | number | null>(null)
  const [isLoadingProgram, setIsLoadingProgram] = useState(true)
  const [showProgramMenu, setShowProgramMenu] = useState(true)
  const [showCustomBuilder, setShowCustomBuilder] = useState(false)
  const [presetProgramRows, setPresetProgramRows] = useState<Array<{ id: string | number; name: string }>>([])

  const [day, setDay] = useState(1)
  const [currentProgramDayId, setCurrentProgramDayId] = useState<string | null>(null)
  const [currentProgramIsPrivate, setCurrentProgramIsPrivate] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [progress, setProgress] = useState<Record<string, number>>({})
  const [customInput, setCustomInput] = useState<Record<string, string>>({})

  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyByExercise, setHistoryByExercise] = useState<Record<string, number>>({})
  const [historyTotalsSplit, setHistoryTotalsSplit] = useState<{ steps: number; others: number }>({ steps: 0, others: 0 })
  const [myTotalStars, setMyTotalStars] = useState(0)
  const [leaderboardRows, setLeaderboardRows] = useState<
    Array<{ rank: number; userId: string; label: string; totalStars: number }>
  >([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [catalogMetaById, setCatalogMetaById] = useState<
    Record<number, { weight: number; unit: string; defaultTarget: number; label: string; key: string }>
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
      const uid = await getOrCreateUserId()
      await loadPresetPrograms(uid)
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
      .select("exercise_name,reps_done,unit_override,catalog_exercise_id")
      .eq("user_id", uid)
      .eq("program_id", pid)
      .limit(10000)

    if (error) {
      setDbg("ERROR history breakdown: " + error.message)
      return
    }

    const { data: catalogRows, error: catalogErr } = await supabase.from("exercise_catalog").select("id,unit")
    if (catalogErr) {
      setDbg("ERROR catalog units: " + catalogErr.message)
    }
    const unitByCatalogId = new Map<number, string>()
    ;(catalogRows ?? []).forEach((r) => {
      const id = Number((r as { id?: number | string }).id)
      if (Number.isFinite(id)) {
        unitByCatalogId.set(id, String((r as { unit?: string | null }).unit ?? ""))
      }
    })

    const map: Record<string, number> = {}
    let steps = 0
    let others = 0
    data?.forEach((r) => {
      const done = Number((r as { reps_done?: number | null }).reps_done) || 0
      const exerciseName = String((r as { exercise_name?: string | null }).exercise_name ?? "")
      map[exerciseName] = (map[exerciseName] || 0) + done

      const unitOverride = String((r as { unit_override?: string | null }).unit_override ?? "")
      const catalogId = Number((r as { catalog_exercise_id?: number | null }).catalog_exercise_id)
      const catalogUnit = Number.isFinite(catalogId) ? String(unitByCatalogId.get(catalogId) ?? "") : ""
      const unit = unitOverride || catalogUnit
      if (unit === "steps") {
        steps += done
      } else {
        others += done
      }
    })
    setHistoryByExercise(map)
    setHistoryTotalsSplit({ steps, others })
  }

  const ensureCatalogMeta = async () => {
    if (Object.keys(catalogMetaById).length > 0) return catalogMetaById
    const result = await loadExerciseCatalog()
    if (result.error) throw new Error(result.error)
    const map: Record<number, { weight: number; unit: string; defaultTarget: number; label: string; key: string }> = {}
    result.data.forEach((item) => {
      map[item.id] = {
        weight: Number(item.weight) || 1,
        unit: item.unit,
        defaultTarget: Number(item.default_target) || 0,
        label: item.label,
        key: item.key,
      }
    })
    setCatalogMetaById(map)
    return map
  }

  const computeTotalStarsByUsers = async (userIds: string[]) => {
    const { data: catalogRows, error: catalogErr } = await supabase
      .from("exercise_catalog")
      .select("id,weight,label")
    if (catalogErr) throw new Error(catalogErr.message)
    const weightByCatalogId = new Map<number, number>()
    const weightByLabel = new Map<string, number>()
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")
    ;(catalogRows ?? []).forEach((r) => {
      const id = Number(r.id)
      const weight = Number(r.weight)
      if (Number.isFinite(id)) weightByCatalogId.set(id, weight)
      const label = String((r as { label?: string | null }).label ?? "")
      if (label) weightByLabel.set(normalize(label), weight)
    })

    const totals = new Map<string, number>()
    userIds.forEach((id) => totals.set(id, 0))
    if (userIds.length === 0) return totals

    type BreakdownRow = {
      user_id?: string | null
      reps_done?: number | null
      weight_override?: number | null
      catalog_exercise_id?: number | null
      exercise_name?: string | null
    }
    let breakdownRows: BreakdownRow[] = []
    const repsQuery = await supabase
      .from("user_day_history_exercises")
      .select("user_id,reps_done,weight_override,catalog_exercise_id,exercise_name")
      .in("user_id", userIds)
    if (repsQuery.error) throw new Error(repsQuery.error.message)
    breakdownRows = (repsQuery.data as BreakdownRow[]) ?? []

    breakdownRows.forEach((row) => {
      const userId = String(row.user_id ?? "")
      if (!userId || !totals.has(userId)) return
      const done = Number(row.reps_done) || 0
      if (done <= 0) return

      const overrideWeight = Number(row.weight_override)
      let weight = Number.isFinite(overrideWeight) && overrideWeight > 0 ? overrideWeight : NaN

      if (!Number.isFinite(weight) || weight <= 0) {
        const catalogId = Number(row.catalog_exercise_id)
        if (Number.isFinite(catalogId)) {
          const catalogWeight = Number(weightByCatalogId.get(catalogId))
          if (Number.isFinite(catalogWeight) && catalogWeight > 0) weight = catalogWeight
        }
      }

      if ((!Number.isFinite(weight) || weight <= 0) && row.catalog_exercise_id == null) {
        const nameKey = normalize(String(row.exercise_name ?? ""))
        const fallbackWeight = Number(weightByLabel.get(nameKey))
        if (Number.isFinite(fallbackWeight) && fallbackWeight > 0) weight = fallbackWeight
      }

      if (!Number.isFinite(weight) || weight <= 0) return

      const stars = Math.floor(done / weight)
      totals.set(userId, (totals.get(userId) ?? 0) + stars)
    })

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
      setCurrentProgramDayId(null)
      setExercises([])
      setProgress({})
      return
    }
    setCurrentProgramDayId(String(pd.id))

    let exList: Exercise[] = []
    const withFlagsQuery = await supabase
      .from("day_exercises")
      .select("id,name,target_reps,sort_order,catalog_exercise_id,is_user_added,is_one_off")
      .eq("program_day_id", pd.id)
      .order("sort_order")
    let exs: Array<Record<string, unknown>> | null = (withFlagsQuery.data as Array<Record<string, unknown>> | null) ?? null
    let exerr = withFlagsQuery.error
    if (exerr) {
      const fallbackQuery = await supabase
        .from("day_exercises")
        .select("id,name,target_reps,sort_order,catalog_exercise_id")
        .eq("program_day_id", pd.id)
        .order("sort_order")
      exs = (fallbackQuery.data as Array<Record<string, unknown>> | null) ?? null
      exerr = fallbackQuery.error
    }
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
        catalog_key: resolvedCatalogId != null ? catalogMap[resolvedCatalogId]?.key : undefined,
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
        setCurrentProgramDayId(null)
        setCurrentProgramIsPrivate(false)
        setProgramId(null)
        setShowProgramMenu(true)
        await loadPresetPrograms(uid)
        setLoading(false)
        setIsLoadingProgram(false)
        return
      }

      const currentDay = state.current_day ?? 1
      let selectedProgramId = state.program_id as string | number | null
      let effectiveDay = currentDay

      setDay(currentDay)
      setProgramId(selectedProgramId)
      setCurrentProgramIsPrivate(false)
      setShowProgramMenu(selectedProgramId == null)

      if (selectedProgramId == null) {
        await loadPresetPrograms(uid)
        setLoading(false)
        setIsLoadingProgram(false)
        return
      }

      const { data: selectedProgramMeta, error: selectedProgramMetaErr } = await supabase
        .from("programs")
        .select("id,is_public,owner_user_id")
        .eq("id", selectedProgramId)
        .single()
      if (selectedProgramMetaErr) {
        setDbg("ERROR program meta: " + selectedProgramMetaErr.message)
      } else if (selectedProgramMeta) {
        const isPublicPreset = Boolean(selectedProgramMeta.is_public) && selectedProgramMeta.owner_user_id == null
        const isPersonalProgram = !selectedProgramMeta.is_public && String(selectedProgramMeta.owner_user_id ?? "") === uid
        if (isPublicPreset) {
          const clone = await clonePublicProgram(selectedProgramId, uid)
          if (clone.ok && clone.programId != null) {
            selectedProgramId = clone.programId
            await upsertUserStateProgram(uid, selectedProgramId, 1)
            effectiveDay = 1
            setDay(1)
            setProgramId(selectedProgramId)
            setCurrentProgramIsPrivate(true)
          } else {
            setDbg("ERROR program clone: " + (clone.error ?? "failed"))
          }
        } else if (!isPersonalProgram) {
          setProgramId(null)
          setShowProgramMenu(true)
          await loadPresetPrograms(uid)
          setLoading(false)
          setIsLoadingProgram(false)
          return
        } else {
          setCurrentProgramIsPrivate(true)
        }
      }

      await loadDay(uid, selectedProgramId, effectiveDay)
      await fetchHistory(uid, selectedProgramId)
      await fetchHistoryBreakdown(uid, selectedProgramId)
      await loadLeaderboard(uid)

      setDbg(`OK: day ${effectiveDay}`)
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

  const loadPresetPrograms = async (_uid: string) => {
    const { data, error } = await supabase
      .from("programs")
      .select("id,name,created_at")
      .eq("is_public", true)
      .is("owner_user_id", null)
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

  const upsertUserStateProgram = async (uid: string, selectedProgramId: string | number, startDay: number) => {
    const { data: updatedRows, error: updateErr } = await supabase
      .from("user_state")
      .update({ program_id: selectedProgramId, current_day: startDay })
      .eq("user_id", uid)
      .select("user_id")
      .limit(1)

    if (updateErr) {
      setDbg("ERROR program assign: " + updateErr.message)
      return false
    }
    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertStateErr } = await supabase
        .from("user_state")
        .insert({ user_id: uid, program_id: selectedProgramId, current_day: startDay })
      if (insertStateErr) {
        setDbg("ERROR user_state create: " + insertStateErr.message)
        return false
      }
    }
    return true
  }

  const clonePublicProgram = async (presetId: string | number, uid: string): Promise<{ ok: boolean; programId?: string | number; error?: string }> => {
    const { data, error } = await supabase.rpc("clone_program", {
      p_preset_program_id: presetId,
      p_owner_user_id: uid,
    })

    if (error) {
      console.error("clone_program failed", { error, presetId, userId: uid })
      return { ok: false, error: error.message }
    }

    let programId: string | number | null = null
    if (typeof data === "string" || typeof data === "number") {
      programId = data
    } else if (Array.isArray(data) && data.length > 0) {
      const row = data[0] as Record<string, unknown>
      const value = (row.id as string | number | undefined) ?? (Object.values(row)[0] as string | number | undefined)
      programId = value ?? null
    } else if (data && typeof data === "object") {
      const row = data as Record<string, unknown>
      const value = (row.id as string | number | undefined) ?? (Object.values(row)[0] as string | number | undefined)
      programId = value ?? null
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const asString = programId != null ? String(programId) : ""
    if (!asString || !uuidRegex.test(asString)) {
      return { ok: false, error: "no program id returned" }
    }

    return { ok: true, programId: asString }
  }

  const chooseBuiltInProgram = async (pickedProgramId?: string | number) => {
    const uid = await getOrCreateUserId()
    setIsLoadingProgram(true)

    let selectedProgramId: string | number | null = pickedProgramId ?? null
    const startDay = 1

    if (selectedProgramId == null) {
      selectedProgramId = presetProgramRows[0]?.id ?? null
    }

    if (selectedProgramId == null) {
      setDbg("ERROR program select: built-in program not found")
      setIsLoadingProgram(false)
      return
    }

    const { data: pickedProgram, error: pickedErr } = await supabase
      .from("programs")
      .select("id,is_public,owner_user_id")
      .eq("id", selectedProgramId)
      .single()
    if (pickedErr || !pickedProgram) {
      setDbg("ERROR program select: " + (pickedErr?.message ?? "program not found"))
      setIsLoadingProgram(false)
      return
    }

    const isPublicPreset = Boolean(pickedProgram.is_public) && pickedProgram.owner_user_id == null
    if (!isPublicPreset) {
      setDbg("ERROR program select: preset not found")
      setIsLoadingProgram(false)
      return
    }

    const clone = await clonePublicProgram(selectedProgramId, uid)
    if (!clone.ok || clone.programId == null) {
      setDbg("ERROR program clone: " + (clone.error ?? "failed"))
      setIsLoadingProgram(false)
      return
    }
    selectedProgramId = clone.programId
    setCurrentProgramIsPrivate(true)

    setProgramId(selectedProgramId)
    setShowProgramMenu(false)
    setShowCustomBuilder(false)
    setTab("today")
    setDay(startDay)
    await upsertUserStateProgram(uid, selectedProgramId, startDay)

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
        catalogKey: (x as { catalogKey?: string | null }).catalogKey ?? null,
        name: x.name.trim(),
        target:
          ((x as { catalogKey?: string | null }).catalogKey ?? null) === "custom_reps"
            ? Math.max(1, Number(x.target) || 0)
            : Math.max(1, Number(x.target) || 0),
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
      setCurrentProgramIsPrivate(true)
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

  const addExerciseFromToday = async (payload: {
    catalogExerciseId: number
    target: number
    displayName?: string
    scope: "today" | "same_type" | "every_day"
  }): Promise<{ ok: boolean; error?: string }> => {
    if (programId == null || currentProgramDayId == null) return { ok: false, error: "Program day is not loaded" }
    const uid = await getOrCreateUserId()
    const catalogMap = await ensureCatalogMeta()
    const meta = catalogMap[payload.catalogExerciseId]
    if (!meta) return { ok: false, error: "Catalog exercise not found" }

    const target = Math.max(1, Number(payload.target) || 0)
    if (target <= 0) return { ok: false, error: "Target must be greater than zero" }

    const isCustom = meta.key === "custom_time" || meta.key === "custom_reps"
    const name = (payload.displayName ?? "").trim() || (isCustom ? "" : meta.label)
    if (isCustom && !name) return { ok: false, error: "Custom exercise name is required" }

    let targetDayIds: string[] = []
    if (payload.scope === "today") {
      targetDayIds = [currentProgramDayId]
    } else {
      const { data: dayRows, error: dayErr } = await supabase
        .from("program_days")
        .select("id,day_number")
        .eq("program_id", programId)
      if (dayErr) return { ok: false, error: dayErr.message }
      const parity = day % 2
      targetDayIds = (dayRows ?? [])
        .filter((r) => (payload.scope === "every_day" ? true : Number(r.day_number) % 2 === parity))
        .map((r) => String(r.id))
    }
    if (targetDayIds.length === 0) return { ok: false, error: "No target days found" }

    const { data: existingRows, error: existingErr } = await supabase
      .from("day_exercises")
      .select("program_day_id,sort_order")
      .in("program_day_id", targetDayIds)
    if (existingErr) return { ok: false, error: existingErr.message }
    const maxSortByDay = new Map<string, number>()
    ;(existingRows ?? []).forEach((r) => {
      const key = String(r.program_day_id)
      const current = maxSortByDay.get(key) ?? 0
      maxSortByDay.set(key, Math.max(current, Number(r.sort_order) || 0))
    })

    const baseRows = targetDayIds.map((dayId) => ({
      program_day_id: dayId,
      catalog_exercise_id: payload.catalogExerciseId,
      name,
      target_reps: target,
      sort_order: (maxSortByDay.get(dayId) ?? 0) + 1,
    }))

    const rowsWithFlags = baseRows.map((row) => ({
      ...row,
      is_user_added: true,
      is_one_off: payload.scope === "today",
    }))

    const insertWithFlags = await supabase.from("day_exercises").insert(rowsWithFlags)
    if (insertWithFlags.error) {
      const insertWithoutFlags = await supabase.from("day_exercises").insert(baseRows)
      if (insertWithoutFlags.error) return { ok: false, error: insertWithoutFlags.error.message }
    }

    await loadDay(uid, programId, day)
    return { ok: true }
  }

  const deleteExerciseWithScope = async (payload: {
    exerciseId: string
    catalogExerciseId: number | null
    name: string
    target: number
    scope: "today" | "all" | "parity"
  }): Promise<{ ok: boolean; error?: string }> => {
    if (programId == null) return { ok: false, error: "Program is not selected" }
    const uid = await getOrCreateUserId()

    const { data: programMeta, error: programMetaErr } = await supabase
      .from("programs")
      .select("owner_user_id,is_public")
      .eq("id", programId)
      .single()
    if (programMetaErr) return { ok: false, error: programMetaErr.message }
    const isPersonalProgram =
      String((programMeta as { owner_user_id?: string | null }).owner_user_id ?? "") === uid &&
      !(programMeta as { is_public?: boolean }).is_public
    if (!isPersonalProgram) {
      return { ok: false, error: "Preset is read-only" }
    }

    const { data: todayDayRow, error: todayDayErr } = await supabase
      .from("program_days")
      .select("id,day_number")
      .eq("program_id", programId)
      .eq("day_number", day)
      .single()
    if (todayDayErr || !todayDayRow) return { ok: false, error: todayDayErr?.message ?? "Today day not found" }
    const todayDayId = String(todayDayRow.id)
    const todayParity = Number(todayDayRow.day_number) % 2

    let targetDayIds: string[] = [todayDayId]
    if (payload.scope !== "today") {
      const { data: dayRows, error: dayErr } = await supabase
        .from("program_days")
        .select("id,day_number")
        .eq("program_id", programId)
      if (dayErr) return { ok: false, error: dayErr.message }
      targetDayIds = (dayRows ?? [])
        .filter((r) => (payload.scope === "all" ? true : Number(r.day_number) % 2 === todayParity))
        .map((r) => String(r.id))
    }

    const { data: candidateRows, error: candidateErr } = await supabase
      .from("day_exercises")
      .select("id,program_day_id,catalog_exercise_id,name,target_reps")
      .in("program_day_id", targetDayIds)
    if (candidateErr) return { ok: false, error: candidateErr.message }

    const matches = (candidateRows ?? []).filter((row) => {
      if (payload.catalogExerciseId != null) {
        return Number(row.catalog_exercise_id) === Number(payload.catalogExerciseId)
      }
      return String(row.name ?? "") === payload.name && Number(row.target_reps) === Number(payload.target)
    })
    const idsToDelete = matches.map((row) => String(row.id))
    if (idsToDelete.length === 0) {
      await loadDay(uid, programId, day)
      return { ok: true }
    }

    const { error: deleteErr } = await supabase.from("day_exercises").delete().in("id", idsToDelete)
    if (deleteErr) return { ok: false, error: deleteErr.message }

    const todayDeletedIds = matches
      .filter((row) => String(row.program_day_id) === todayDayId)
      .map((row) => String(row.id))
    if (todayDeletedIds.length > 0) {
      const entryDate = localISODate()
      await supabase
        .from("user_exercise_progress")
        .delete()
        .eq("user_id", uid)
        .eq("local_date", entryDate)
        .in("day_exercise_id", todayDeletedIds)
    }

    await loadDay(uid, programId, day)
    return { ok: true }
  }

  const deleteAddedExercise = async (payload: {
    exerciseId: string
    catalogExerciseId: number | null
    name: string
    target: number
    scope: "today" | "all" | "parity"
  }): Promise<{ ok: boolean; error?: string }> => {
    return deleteExerciseWithScope(payload)
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
    const missingCatalogIds = exercises.filter((ex) => ex.catalog_exercise_id == null).map((ex) => ex.id)
    const catalogByExerciseId = new Map<string, number>()
    if (missingCatalogIds.length > 0) {
      const { data: dayExerciseRows } = await supabase
        .from("day_exercises")
        .select("id,catalog_exercise_id")
        .in("id", missingCatalogIds)
      ;(dayExerciseRows ?? []).forEach((row) => {
        const catalogId = Number((row as { catalog_exercise_id?: number | null }).catalog_exercise_id)
        if (Number.isFinite(catalogId)) {
          catalogByExerciseId.set(String(row.id), catalogId)
        }
      })
    }

    type BreakdownRow = {
      user_id: string
      program_id: string | number
      day_number: number
      local_date: string
      exercise_name: string
      reps_done: number
      reps_target: number
      day_exercise_id?: string
      catalog_exercise_id: number | null
      unit_override: "minutes" | "reps" | null
      weight_override: number | null
    }

    const breakdownRows: BreakdownRow[] = exercises.map((ex) => {
      const repsTarget = Math.max(1, Number(ex.target_reps) || 0)
      const isCustomTime = ex.catalog_key === "custom_time"
      const isCustomReps = ex.catalog_key === "custom_reps"
      const resolvedCatalogId =
        ex.catalog_exercise_id != null ? ex.catalog_exercise_id : (catalogByExerciseId.get(ex.id) ?? null)
      return {
        user_id: uid,
        program_id: programId,
        day_number: day,
        local_date: entryDate,
        exercise_name: ex.name,
        reps_done: progress[ex.id] || 0,
        reps_target: repsTarget,
        day_exercise_id: ex.id,
        catalog_exercise_id: resolvedCatalogId,
        unit_override: isCustomTime ? ("minutes" as const) : isCustomReps ? ("reps" as const) : null,
        weight_override: isCustomTime ? 1 : isCustomReps ? repsTarget / 50 : null,
      }
    })

    const dedupeBreakdownRows = (rows: BreakdownRow[]) => {
      const byKey = new Map<string, BreakdownRow>()
      rows.forEach((row) => {
        const key = `${row.user_id}__${String(row.program_id)}__${row.day_number}__${row.exercise_name}`
        const prev = byKey.get(key)
        if (!prev) {
          byKey.set(key, { ...row })
          return
        }
        byKey.set(key, {
          ...prev,
          reps_done: (Number(prev.reps_done) || 0) + (Number(row.reps_done) || 0),
          reps_target: Math.max(Number(prev.reps_target) || 0, Number(row.reps_target) || 0),
          catalog_exercise_id: prev.catalog_exercise_id ?? row.catalog_exercise_id ?? null,
          unit_override: prev.unit_override ?? row.unit_override ?? null,
          weight_override: prev.weight_override ?? row.weight_override ?? null,
          day_exercise_id: prev.day_exercise_id ?? row.day_exercise_id,
        })
      })
      return Array.from(byKey.values())
    }

    const persistBreakdown = async (rows: BreakdownRow[]) => {
      const dedupedRows = dedupeBreakdownRows(rows)
      const upsertResult = await supabase
        .from("user_day_history_exercises")
        .upsert(dedupedRows, { onConflict: "user_id,program_id,day_number,exercise_name" })
      if (!upsertResult.error) return null

      if (upsertResult.error.message?.includes("day_exercise_id")) {
        const rowsWithoutDayExercise = dedupedRows.map(({ day_exercise_id: _drop, ...rest }) => rest)
        const retry = await supabase
          .from("user_day_history_exercises")
          .upsert(rowsWithoutDayExercise, { onConflict: "user_id,program_id,day_number,exercise_name" })
        if (!retry.error) return null
        return retry.error
      }

      const { error: delErr } = await supabase
        .from("user_day_history_exercises")
        .delete()
        .eq("user_id", uid)
        .eq("program_id", programId)
        .eq("day_number", day)
      if (delErr) return upsertResult.error

      const insertResult = await supabase.from("user_day_history_exercises").insert(dedupedRows)
      if (!insertResult.error) return null

      if (insertResult.error.message?.includes("day_exercise_id")) {
        const rowsWithoutDayExercise = dedupedRows.map(({ day_exercise_id: _drop, ...rest }) => rest)
        const retryInsert = await supabase.from("user_day_history_exercises").insert(rowsWithoutDayExercise)
        if (!retryInsert.error) return null
        return retryInsert.error
      }

      return insertResult.error
    }

    const breakdownErr = await persistBreakdown(breakdownRows)
    if (breakdownErr) {
      setDbg("ERROR breakdown save: " + breakdownErr.message)
      return
    }

    const customExerciseNames = breakdownRows.filter((r) => r.unit_override != null).map((r) => r.exercise_name)
    if (customExerciseNames.length > 0) {
      const { data: verifyRows, error: verifyErr } = await supabase
        .from("user_day_history_exercises")
        .select("exercise_name,unit_override,weight_override,catalog_exercise_id")
        .eq("user_id", uid)
        .eq("program_id", programId)
        .eq("day_number", day)
        .in("exercise_name", customExerciseNames)
      if (!verifyErr && verifyRows) {
        const hasMissingOverrides = verifyRows.some(
          (r) =>
            (r.unit_override == null || r.weight_override == null) &&
            customExerciseNames.includes(String(r.exercise_name ?? ""))
        )
        if (hasMissingOverrides) {
          console.error("breakdown verify: overrides are null for custom rows", verifyRows)
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

  const totalsSplit = historyTotalsSplit

  const editCatalogOptions = useMemo(
    () =>
      Object.entries(catalogMetaById)
        .map(([id, meta]) => ({
          id: Number(id),
          // Localized labels for RU in exercise pickers.
          label:
            meta.key === "custom_time"
              ? lang === "ru"
                ? "Своё упражнение (время)"
                : "Custom (time)"
              : meta.key === "custom_reps"
                ? lang === "ru"
                  ? "Своё упражнение (повторы)"
                  : "Custom (reps)"
                : lang === "ru"
                  ? (() => {
                      const key = meta.label.trim().toLowerCase()
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
                      return map[key] ?? meta.label
                    })()
                  : meta.label,
          unit: meta.unit,
          defaultTarget: meta.defaultTarget,
          key: meta.key,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [catalogMetaById, lang]
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

  const howItWorksExamples = useMemo(() => {
    const values = Object.values(catalogMetaById)
    const trRuLabel = (label: string) => {
      const key = label.trim().toLowerCase()
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
      return map[key] ?? label
    }
    const preferred = ["push_ups", "walking", "pull_ups", "squats", "abs"]
      .map((k) => values.find((x) => x.key === k))
      .filter((x): x is { weight: number; unit: string; defaultTarget: number; label: string; key: string } => Boolean(x))
    const picked = preferred.length > 0 ? preferred : values.slice(0, 5)
    const unitLabel = (unit: string) =>
      unit === "steps" ? (lang === "ru" ? "шагов" : "steps") : unit === "minutes" ? (lang === "ru" ? "мин" : "min") : lang === "ru" ? "повторов" : "reps"

    const lines = picked.slice(0, 5).map((item) => {
      const label =
        lang === "ru"
          ? item.key === "custom_time"
            ? "Своё упражнение (время)"
            : item.key === "custom_reps"
              ? "Своё упражнение (повторы)"
              : trRuLabel(item.label)
          : item.key === "custom_time"
            ? "Custom (time)"
            : item.key === "custom_reps"
              ? "Custom (reps)"
              : item.label
      return `${label}: 1★ = ${Math.round(item.weight * 100) / 100} ${unitLabel(item.unit)}`
    })

    const hasCustomTimeLine = lines.some((x) => x.toLowerCase().includes("custom (time)") || x.toLowerCase().includes("своё упражнение (время)"))
    if (!hasCustomTimeLine) {
      lines.push(`${lang === "ru" ? "Своё упражнение (время)" : "Custom time"}: 1★ = 1 ${lang === "ru" ? "мин" : "min"}`)
    }
    return lines.slice(0, 6)
  }, [catalogMetaById, lang])

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
            programId={programId}
            catalogOptions={editCatalogOptions}
            canDeleteExercises={currentProgramIsPrivate}
            onAddExercise={addExerciseFromToday}
            onDeleteExercise={deleteAddedExercise}
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

                const { data: programMeta } = await supabase
                  .from("programs")
                  .select("id,owner_user_id,is_public")
                  .eq("id", programId)
                  .single()
                const shouldDeleteProgram =
                  Boolean(programMeta) &&
                  String((programMeta as { owner_user_id?: string | null }).owner_user_id ?? "") === uid &&
                  !(programMeta as { is_public?: boolean }).is_public

                if (shouldDeleteProgram) {
                  const { data: dayRows } = await supabase
                    .from("program_days")
                    .select("id")
                    .eq("program_id", programId)
                  const dayIds = (dayRows ?? []).map((d) => d.id)
                  if (dayIds.length > 0) {
                    await supabase.from("day_exercises").delete().in("program_day_id", dayIds)
                    await supabase.from("program_days").delete().in("id", dayIds)
                  }
                  await supabase.from("programs").delete().eq("id", programId)
                }
              }
              await loadPresetPrograms(uid)

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
              setCurrentProgramDayId(null)
              setCurrentProgramIsPrivate(false)
              setProgramId(null)
              setShowProgramMenu(true)
              setShowCustomBuilder(false)
              setExercises([])
              setProgress({})
              setCustomInput({})
              setHistory([])
              setHistoryByExercise({})
              setHistoryTotalsSplit({ steps: 0, others: 0 })
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
            examples={howItWorksExamples}
            labels={{
              leaderboard: I18N[lang].leaderboardTitle,
              totalStarTitle: I18N[lang].totalStar,
              chooseName: I18N[lang].chooseName,
              save: I18N[lang].save,
              global: I18N[lang].globalLeaderboard,
              loading: I18N[lang].loadingLeaderboard,
              noData: I18N[lang].noData,
              howItWorks: I18N[lang].howItWorks,
              howItWorksTitle: I18N[lang].howItWorksTitle,
              howItWorksBody: I18N[lang].howItWorksBody,
              examplesTitle: I18N[lang].examplesTitle,
              ok: I18N[lang].ok,
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

