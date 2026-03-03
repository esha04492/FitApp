"use client"
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import ActionBtn from "./ActionBtn"
import { clamp } from "../lib/date"
import type { Exercise } from "./types"

export default function TodayView(props: {
  lang?: "ru" | "en"
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
  programId: string | number | null
  catalogOptions: Array<{ id: number; label: string; unit: string; defaultTarget: number; key?: string }>
  canDeleteExercises: boolean
  onAddExercise: (payload: {
    catalogExerciseId: number
    target: number
    displayName?: string
    scope: "today" | "same_type" | "every_day"
  }) => Promise<{ ok: boolean; error?: string }>
  onDeleteExercise: (payload: {
    exerciseId: string
    catalogExerciseId: number | null
    name: string
    target: number
    scope: "today" | "all" | "parity"
  }) => Promise<{ ok: boolean; error?: string }>
  editExercise: (payload: {
    exerciseId: string
    originalName: string
    name: string
    target: number
    catalogExerciseId: number | null
    applyTo: "today" | "program"
  }) => Promise<{ ok: boolean; error?: string }>
}) {
  const [showSkip, setShowSkip] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [editExerciseId, setEditExerciseId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editTarget, setEditTarget] = useState("1")
  const [editCatalogExerciseId, setEditCatalogExerciseId] = useState<string>("")
  const [editUnit, setEditUnit] = useState("")
  const [editApplyTo, setEditApplyTo] = useState<"today" | "program">("today")
  const [editError, setEditError] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [addCatalogId, setAddCatalogId] = useState("")
  const [addTarget, setAddTarget] = useState("1")
  const [addDisplayName, setAddDisplayName] = useState("")
  const [addScope, setAddScope] = useState<"today" | "same_type" | "every_day">("today")
  const [addError, setAddError] = useState<string | null>(null)
  const [savingAdd, setSavingAdd] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Exercise | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null)
  const [deleteScope, setDeleteScope] = useState<"today" | "all" | "parity">("today")
  const [toast, setToast] = useState<string | null>(null)

  const {
    lang = "ru",
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
    programId,
    catalogOptions,
    canDeleteExercises,
    onAddExercise,
    onDeleteExercise,
    editExercise,
  } = props

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

  const trUnit = (unit: string | undefined) => {
    if (!unit) return ""
    if (lang !== "ru") return unit
    if (unit === "reps") return "повт."
    if (unit === "steps") return "шаги"
    if (unit === "minutes") return "мин"
    return unit
  }

  const tx =
    lang === "ru"
      ? {
          workout: "Тренировка",
          day: "День",
          streak: "Серия",
          dayProgress: "Прогресс дня",
          dayComplete: "День завершен",
          finishAll: "Заверши все упражнения",
          exercise: "Упражнение",
          edit: "Изменить",
          completed: "Выполнено",
          left: "Осталось",
          anyNumber: "Любое число",
          add: "Добавить",
          nextDay: "Следующий день",
          skipDay: "Пропустить день",
          skipConfirm: "Ты уверен, что хочешь пропустить день?",
          no: "Нет",
          yes: "Да",
          editExercise: "Редактировать упражнение",
          nameRequired: "Название обязательно",
          updateFailed: "Не удалось обновить",
          applyTo: "Применить изменения к:",
          todayOnly: "Только сегодня",
          wholeProgram: "Вся программа",
          sameDayType: "Каждый такой же день",
          everyDay: "Каждый день",
          scope: "Область применения:",
          cancel: "Отмена",
          save: "Сохранить",
          addExercise: "Добавить упражнение",
          addExerciseTitle: "Добавить упражнение",
          selectExercise: "Выбери упражнение",
          addNameOptional: "Название (необязательно)",
          addNameRequired: "Название (обязательно для custom)",
          targetRequired: "Нужно указать цель",
          customNameRequired: "Для кастомного упражнения нужно название",
          delete: "Удалить",
          deleteConfirm: "Удалить упражнение?",
          deleteToday: "Только сегодня",
          deleteAll: "Все дни",
          deleteParity: "Такая же чётность как сегодня",
          readOnlyPreset: "Preset is read-only",
          onboardingTitle: "Добро пожаловать в FitStreak",
          onboardingBody:
            "Это приложение помогает фиксировать результаты упражнений в рамках программы.\n\n• Добавляй свои упражнения\n• Соревнуйся с другими пользователями в лидерборде\n• Смотри статистику за все 100 дней",
        }
      : {
          workout: "Workout",
          day: "Day",
          streak: "Streak",
          dayProgress: "Day progress",
          dayComplete: "Day complete",
          finishAll: "Finish all exercises",
          exercise: "Exercise",
          edit: "Edit",
          completed: "Completed",
          left: "Left",
          anyNumber: "Any number",
          add: "Add",
          nextDay: "Next day",
          skipDay: "Skip day",
          skipConfirm: "Are you sure you want to skip this day?",
          no: "No",
          yes: "Yes",
          editExercise: "Edit exercise",
          nameRequired: "Name is required",
          updateFailed: "Update failed",
          applyTo: "Apply changes to:",
          todayOnly: "Today only",
          wholeProgram: "Whole program",
          sameDayType: "Every same day type",
          everyDay: "Every day",
          scope: "Scope:",
          cancel: "Cancel",
          save: "Save",
          addExercise: "Add exercise",
          addExerciseTitle: "Add exercise",
          selectExercise: "Select exercise",
          addNameOptional: "Display name (optional)",
          addNameRequired: "Display name (required for custom)",
          targetRequired: "Target is required",
          customNameRequired: "Custom exercise name is required",
          delete: "Delete",
          deleteConfirm: "Delete this exercise?",
          deleteToday: "Only today",
          deleteAll: "All days",
          deleteParity: "Same parity as today",
          readOnlyPreset: "Preset is read-only",
          onboardingTitle: "Welcome to FitStreak",
          onboardingBody:
            "This app helps you track exercise results within your program.\n\n• Add your own exercises\n• Compete with other users on leaderboard\n• View your full statistics for all 100 days",
        }

  useEffect(() => {
    if (typeof window === "undefined") return
    if (programId == null) {
      setShowOnboarding(false)
      return
    }
    const key = `intro_seen_for_program_${programId}`
    setShowOnboarding(localStorage.getItem(key) !== "1")
  }, [programId])

  const selectedExercise = useMemo(
    () => exercises.find((x) => x.id === editExerciseId) ?? null,
    [editExerciseId, exercises]
  )

  const dismissOnboarding = () => {
    if (programId != null) {
      localStorage.setItem(`intro_seen_for_program_${programId}`, "1")
    }
    setShowOnboarding(false)
  }

  const openEdit = (exercise: Exercise) => {
    const fallbackCatalog =
      exercise.catalog_exercise_id != null
        ? catalogOptions.find((x) => x.id === exercise.catalog_exercise_id)
        : catalogOptions.find((x) => x.label.trim().toLowerCase() === String(exercise.name ?? "").trim().toLowerCase())

    setEditExerciseId(exercise.id)
    setEditName(fallbackCatalog?.label ?? exercise.name)
    setEditTarget(String(exercise.target_reps))
    setEditCatalogExerciseId(fallbackCatalog ? String(fallbackCatalog.id) : "")
    setEditUnit(fallbackCatalog?.unit ?? exercise.unit ?? "")
    setEditApplyTo("today")
    setEditError(null)
  }

  const closeEdit = () => {
    if (savingEdit) return
    setEditExerciseId(null)
    setEditError(null)
  }

  const saveEdit = async () => {
    if (!selectedExercise || savingEdit) return
    const name = editName.trim()
    const target = Math.max(1, Number(editTarget) || 0)
    if (!name) {
      setEditError(tx.nameRequired)
      return
    }

    setSavingEdit(true)
    setEditError(null)

    const result = await editExercise({
      exerciseId: selectedExercise.id,
      originalName: selectedExercise.name,
      name,
      target,
      catalogExerciseId: editCatalogExerciseId ? Number(editCatalogExerciseId) : null,
      applyTo: editApplyTo,
    })

    if (!result.ok) {
      setEditError(result.error ?? tx.updateFailed)
      setSavingEdit(false)
      return
    }

    setSavingEdit(false)
    setEditExerciseId(null)
  }

  const selectedAddCatalogItem =
    addCatalogId.length > 0 ? catalogOptions.find((x) => String(x.id) === addCatalogId) ?? null : null
  const isAddCustom = selectedAddCatalogItem?.key === "custom_time" || selectedAddCatalogItem?.key === "custom_reps"

  const submitAddExercise = async () => {
    if (!selectedAddCatalogItem || savingAdd) return
    const target = Math.max(1, Number(addTarget) || 0)
    if (target <= 0) {
      setAddError(tx.targetRequired)
      return
    }
    if (isAddCustom && !addDisplayName.trim()) {
      setAddError(tx.customNameRequired)
      return
    }
    setSavingAdd(true)
    setAddError(null)
    const result = await onAddExercise({
      catalogExerciseId: selectedAddCatalogItem.id,
      target,
      displayName: addDisplayName.trim() || undefined,
      scope: addScope,
    })
    if (!result.ok) {
      setAddError(result.error ?? tx.updateFailed)
      setSavingAdd(false)
      return
    }
    setSavingAdd(false)
    setShowAddExercise(false)
    setAddCatalogId("")
    setAddTarget("1")
    setAddDisplayName("")
    setAddScope("today")
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(timer)
  }, [toast])

  const deleteExerciseNow = async (ex: Exercise, scope: "today" | "all" | "parity") => {
    if (deletingExerciseId) return
    setDeletingExerciseId(ex.id)
    setDeleteError(null)
    const result = await onDeleteExercise({
      exerciseId: ex.id,
      catalogExerciseId: ex.catalog_exercise_id ?? null,
      name: ex.name,
      target: ex.target_reps,
      scope,
    })
    setDeletingExerciseId(null)
    if (!result.ok) {
      setDeleteError(result.error ?? tx.updateFailed)
      return
    }
    setPendingDelete(null)
  }

  return (
    <>
      <div className="mb-7 text-center">
        <div className="text-sm text-neutral-400">{tx.workout}</div>
        <div className="mt-1 flex items-center justify-center gap-2">
          <div className="text-3xl font-semibold tracking-tight">
            {tx.day} {day}
          </div>
          {currentStreak > 0 ? (
            <span className="animate-pulse rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-300">
              🔥 {tx.streak} <span className="font-bold">{currentStreak}</span> 🔥
            </span>
          ) : null}
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
          <div className="flex items-end justify-between gap-3">
            <div className="text-left">
              <div className="text-xs text-neutral-400">{tx.dayProgress}</div>
              <div className="mt-1 text-3xl font-semibold tabular-nums">{dayTotals.pct}%</div>
            </div>

            <div className="text-right text-xs text-neutral-500">{allCompleted ? tx.dayComplete : tx.finishAll}</div>
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-2xl text-center">
            <div className="text-sm font-semibold text-neutral-100">{tx.onboardingTitle}</div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-300">{tx.onboardingBody}</p>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="mt-4 h-10 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition hover:bg-white/10"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="rounded-xl border border-red-400/30 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-100 shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        {exercises.map((ex) => {
          const reps = progress[ex.id] || 0
          const isCompleted = reps >= ex.target_reps
          const percent = clamp(Math.round((reps / ex.target_reps) * 100), 0, 100)
          const remaining = Math.max(ex.target_reps - reps, 0)
          const isSteps = ex.unit === "steps" || ex.target_reps >= 1000 || /step/i.test(ex.name)
          const unitsPerStarBase = ex.weight != null ? Math.round(Number(ex.weight) * 1000) / 1000 : null
          const unitsPerStar =
            ex.catalog_key === "custom_time"
              ? 1
              : ex.catalog_key === "custom_reps"
                ? Math.max(0.001, Math.round((ex.target_reps / 50) * 1000) / 1000)
                : unitsPerStarBase
          const repsOrStepsSingular =
            ex.unit === "steps" ? (lang === "ru" ? "шаг" : "step") : lang === "ru" ? "повтор" : "rep"
          const unitLabel =
            ex.unit === "steps"
              ? lang === "ru"
                ? "шагов"
                : "steps"
              : ex.unit === "minutes"
                ? lang === "ru"
                  ? "мин"
                  : "min"
                : lang === "ru"
                  ? "повторений"
                  : "reps"
          const starCostText =
            unitsPerStar != null && ex.unit
              ? unitsPerStar >= 1
                ? `1 ★ = ${Math.round(unitsPerStar * 100) / 100} ${unitLabel}`
                : `1 ${repsOrStepsSingular} = ${Math.round((1 / unitsPerStar) * 100) / 100} ★`
              : "—"

          return (
            <div
              key={ex.id}
              className={`relative rounded-3xl border bg-white/5 p-4 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.7)] backdrop-blur ${
                isCompleted ? "border-emerald-400/40" : "border-white/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-neutral-400">{tx.exercise}</div>
                  <div className="mt-0.5 text-lg font-semibold">{trExerciseName(ex.name)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(ex)}
                    className="h-8 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-neutral-200 transition hover:bg-white/10"
                    aria-label="Edit exercise"
                  >
                    {tx.edit}
                  </button>
                  {isCompleted ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                      {tx.completed}
                    </span>
                  ) : (
                    <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-300">
                      {tx.left} {pretty(remaining)}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="text-4xl font-semibold tabular-nums tracking-tight">
                  {pretty(reps)}
                  <span className="text-xl text-neutral-500"> / {pretty(ex.target_reps)}</span>
                  <span className="ml-2 text-xs text-amber-300 align-middle">({starCostText})</span>
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

              <div className="mt-3 grid grid-cols-2 gap-2 pr-12">
                <input
                  inputMode="numeric"
                  type="number"
                  placeholder={tx.anyNumber}
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
                  type="button"
                  onClick={() => addCustomReps(ex.id, ex.target_reps)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 shadow-sm transition active:scale-[0.99] hover:bg-white/10"
                >
                  {tx.add}
                </button>
              </div>

              <button
                type="button"
                disabled={deletingExerciseId === ex.id}
                onClick={() => {
                  if (!canDeleteExercises) {
                    setToast(tx.readOnlyPreset)
                    return
                  }
                  setPendingDelete(ex)
                  setDeleteError(null)
                  setDeleteScope("today")
                }}
                className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 transition hover:bg-red-600/20 disabled:opacity-60"
                aria-label={tx.delete}
                title={tx.delete}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => {
            setShowAddExercise(true)
            setAddError(null)
          }}
          className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
        >
          + {tx.addExercise}
        </button>
      </div>

      <div className="mt-6">
        <button
          type="button"
          disabled={!allCompleted}
          onClick={nextDay}
          className={`h-12 w-full rounded-2xl px-4 text-sm font-semibold shadow-sm transition active:scale-[0.99] ${
            allCompleted
              ? "bg-gradient-to-r from-emerald-400 to-emerald-600 text-neutral-950"
              : "bg-white/5 text-neutral-500 border border-white/10 cursor-not-allowed"
          }`}
        >
          {tx.nextDay}
        </button>
        <button
          type="button"
          onClick={() => setShowSkip(true)}
          className="mt-3 text-xs text-neutral-500 hover:text-neutral-300 transition"
        >
          {tx.skipDay}
        </button>
      </div>

      {showSkip ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 px-5 py-4 shadow-2xl">
            <div className="text-base font-semibold text-neutral-100">{tx.skipConfirm}</div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSkip(false)}
                className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
              >
                {tx.no}
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowSkip(false)
                  await skipDay()
                }}
                className="h-9 rounded-xl border border-red-400/30 bg-red-500/15 px-3 text-xs font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/25"
              >
                {tx.yes}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedExercise ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
            <div className="text-sm font-semibold text-neutral-100">{tx.editExercise}</div>
            <div className="mt-3 space-y-2">
              <select
                value={editCatalogExerciseId}
                onChange={(e) => {
                  const selectedId = e.target.value
                  setEditCatalogExerciseId(selectedId)
                  const selected = catalogOptions.find((x) => String(x.id) === selectedId)
                  if (!selected) return
                  setEditName(selected.label)
                  setEditUnit(selected.unit)
                  setEditTarget(String(Math.max(1, Number(selected.defaultTarget) || 1)))
                }}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              >
                {catalogOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {trExerciseName(item.label)} ({trUnit(item.unit)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
              <input
                value={editUnit}
                readOnly
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-300 outline-none"
              />
            </div>

            <div className="mt-4">
              <div className="text-xs text-neutral-400">{tx.applyTo}</div>
              <label className="mt-2 flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="radio"
                  name="applyTo"
                  checked={editApplyTo === "today"}
                  onChange={() => setEditApplyTo("today")}
                />
                <span>{tx.todayOnly}</span>
              </label>
              <label className="mt-1 flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="radio"
                  name="applyTo"
                  checked={editApplyTo === "program"}
                  onChange={() => setEditApplyTo("program")}
                />
                <span>{tx.wholeProgram}</span>
              </label>
            </div>

            {editError ? <div className="mt-3 text-xs text-red-200 break-words">{editError}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-neutral-100 transition hover:bg-white/10"
              >
                {tx.cancel}
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={saveEdit}
                className="h-10 rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
              >
                {tx.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showAddExercise ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
            <div className="text-sm font-semibold text-neutral-100">{tx.addExerciseTitle}</div>
            <div className="mt-3 space-y-2">
              <select
                value={addCatalogId}
                onChange={(e) => {
                  setAddCatalogId(e.target.value)
                  const selected = catalogOptions.find((x) => String(x.id) === e.target.value)
                  if (selected) {
                    setAddTarget(String(Math.max(1, Number(selected.defaultTarget) || 1)))
                    if (selected.key !== "custom_time" && selected.key !== "custom_reps") {
                      setAddDisplayName("")
                    }
                  }
                }}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              >
                <option value="">{tx.selectExercise}</option>
                {catalogOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} ({trUnit(item.unit)})
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                value={addTarget}
                onChange={(e) => setAddTarget(e.target.value)}
                placeholder={tx.anyNumber}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
              <input
                value={addDisplayName}
                onChange={(e) => setAddDisplayName(e.target.value)}
                placeholder={isAddCustom ? tx.addNameRequired : tx.addNameOptional}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
            </div>

            <div className="mt-4">
              <div className="text-xs text-neutral-400">{tx.scope}</div>
              <label className="mt-2 flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name="addScope" checked={addScope === "today"} onChange={() => setAddScope("today")} />
                <span>{tx.todayOnly}</span>
              </label>
              <label className="mt-1 flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name="addScope" checked={addScope === "same_type"} onChange={() => setAddScope("same_type")} />
                <span>{tx.sameDayType}</span>
              </label>
              <label className="mt-1 flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name="addScope" checked={addScope === "every_day"} onChange={() => setAddScope("every_day")} />
                <span>{tx.everyDay}</span>
              </label>
            </div>

            {addError ? <div className="mt-3 text-xs text-red-200 break-words">{addError}</div> : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (savingAdd) return
                  setShowAddExercise(false)
                }}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-neutral-100 transition hover:bg-white/10"
              >
                {tx.cancel}
              </button>
              <button
                type="button"
                disabled={savingAdd}
                onClick={submitAddExercise}
                className="h-10 rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-60"
              >
                {tx.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
            <div className="text-sm font-semibold text-neutral-100">{tx.deleteConfirm}</div>
            <div className="mt-3 space-y-1">
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name="deleteScope" checked={deleteScope === "today"} onChange={() => setDeleteScope("today")} />
                <span>{tx.deleteToday}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name="deleteScope" checked={deleteScope === "all"} onChange={() => setDeleteScope("all")} />
                <span>{tx.deleteAll}</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-200">
                <input type="radio" name="deleteScope" checked={deleteScope === "parity"} onChange={() => setDeleteScope("parity")} />
                <span>{tx.deleteParity}</span>
              </label>
            </div>
            {deleteError ? <div className="mt-3 text-xs text-red-200 break-words">{deleteError}</div> : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (deletingExerciseId) return
                  setPendingDelete(null)
                  setDeleteError(null)
                }}
                className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-neutral-100 transition hover:bg-white/10"
              >
                {tx.cancel}
              </button>
              <button
                type="button"
                disabled={deletingExerciseId != null}
                onClick={() => void deleteExerciseNow(pendingDelete, deleteScope)}
                className="h-10 rounded-xl border border-red-400/20 bg-red-500/15 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-60"
              >
                {tx.delete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
