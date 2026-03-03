"use client"
import { useEffect, useMemo, useState } from "react"
import { loadExerciseCatalog, type CatalogExercise } from "../lib/catalog"

export type BuilderExercise = {
  catalogExerciseId: number
  catalogKey: string | null
  name: string
  target: number
  unit: "reps" | "steps" | "minutes"
  weight: number
}

export default function CustomProgramBuilder(props: {
  onBack: () => void
  onCreate: (payload: { name: string; exercises: BuilderExercise[] }) => Promise<{ ok: boolean; error?: string }>
  lang?: "ru" | "en"
}) {
  const { onBack, onCreate, lang = "ru" } = props

  const [programName, setProgramName] = useState(lang === "ru" ? "Моя программа" : "My program")
  const [catalog, setCatalog] = useState<CatalogExercise[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [exercises, setExercises] = useState<
    Array<{
      catalogExerciseId: number | null
      name: string
      target: number
      unit: "reps" | "steps" | "minutes"
      catalogKey: string | null
      weight: number
    }>
  >([{ catalogExerciseId: null, name: "", target: 0, unit: "reps", catalogKey: null, weight: 1 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tx =
    lang === "ru"
      ? {
          title: "Создай свою программу",
          programName: "Название программы",
          loadingExercises: "Загрузка упражнений...",
          delete: "Удалить",
          duplicate: "Дублировать",
          selectExercise: "Выбери упражнение",
          addExercise: "Добавить упражнение",
          createProgram: "Создать программу",
          back: "Назад",
          creating: "Создание...",
          duplicateError: "Это упражнение уже выбрано",
          createError: "Не удалось создать программу",
          reps: "повторения",
          steps: "шаги",
          minutes: "мин",
          customName: "Название упражнения",
          customTargetMinutes: "Минуты",
          customTargetReps: "Повторения",
          fullCompletionHint: "Полностью выполненная норма ≈ 50 ★",
          customTimeHint: "1 ★ = 1 мин",
        }
      : {
          title: "Create your plan",
          programName: "Program name",
          loadingExercises: "Loading exercises...",
          delete: "Delete",
          duplicate: "Duplicate",
          selectExercise: "Select exercise",
          addExercise: "Add exercise",
          createProgram: "Create program",
          back: "Back",
          creating: "Creating...",
          duplicateError: "This exercise is already selected",
          createError: "Could not create program",
          reps: "reps",
          steps: "steps",
          minutes: "min",
          customName: "Exercise name",
          customTargetMinutes: "Minutes",
          customTargetReps: "Reps",
          fullCompletionHint: "Full completion ≈ 50 ★",
          customTimeHint: "1 ★ = 1 min",
        }

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

  useEffect(() => {
    const run = async () => {
      setCatalogLoading(true)
      const result = await loadExerciseCatalog()
      if (result.error) {
        setCatalog([])
        setCatalogError(result.error)
      } else {
        setCatalog(result.data)
        setCatalogError(null)
      }
      setCatalogLoading(false)
    }
    run()
  }, [])

  const canCreate = useMemo(() => {
    if (catalogLoading) return false
    if (!programName.trim()) return false
    if (exercises.length === 0) return false
    const selectedIds = exercises
      .map((ex) => ex.catalogExerciseId)
      .filter((id): id is number => id != null)
    const uniqueCount = new Set(selectedIds).size
    if (selectedIds.length !== uniqueCount) return false
    return exercises.every((ex) => ex.catalogExerciseId != null && ex.name.trim().length > 0 && ex.target > 0)
  }, [catalogLoading, programName, exercises])

  const updateExercise = (
    index: number,
    patch: Partial<{
      catalogExerciseId: number | null
      name: string
      target: number
      unit: "reps" | "steps" | "minutes"
      catalogKey: string | null
      weight: number
    }>
  ) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  const addExercise = () => {
    setExercises((prev) => [...prev, { catalogExerciseId: null, name: "", target: 0, unit: "reps", catalogKey: null, weight: 1 }])
  }

  const removeExercise = (index: number) => {
    if (exercises.length <= 1) return
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  const duplicateExercise = (index: number) => {
    setExercises((prev) => {
      const item = prev[index]
      if (!item) return prev
      return [...prev.slice(0, index + 1), { ...item }, ...prev.slice(index + 1)]
    })
  }

  const selectExercise = (index: number, selectedIdRaw: string) => {
    const selectedId = Number(selectedIdRaw)
    if (!Number.isFinite(selectedId)) {
      updateExercise(index, { catalogExerciseId: null, name: "", unit: "reps", catalogKey: null, target: 0, weight: 1 })
      return
    }

    const selected = catalog.find((x) => x.id === selectedId)
    if (!selected) return

    const duplicateIndex = exercises.findIndex((x, i) => i !== index && x.catalogExerciseId === selected.id)
    if (duplicateIndex !== -1) {
      setError(tx.duplicateError)
      return
    }

    setError(null)
    setExercises((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              catalogExerciseId: selected.id,
              name: selected.key === "custom_time" || selected.key === "custom_reps" ? "" : selected.label,
              unit: selected.unit,
              catalogKey: selected.key,
              weight: selected.weight,
              target: row.target > 0 ? row.target : selected.default_target,
            }
          : row
      )
    )
  }

  const submit = async () => {
    if (!canCreate || loading) return
    setLoading(true)
    setError(null)

    const payloadExercises = exercises
      .filter((ex): ex is BuilderExercise => ex.catalogExerciseId != null)
      .map((ex) => ({
        catalogExerciseId: ex.catalogExerciseId,
        catalogKey: ex.catalogKey,
        name: ex.name.trim(),
        target:
          ex.catalogKey === "custom_reps"
            ? Math.max(10, Number(ex.target) || 0)
            : Math.max(1, Number(ex.target) || 0),
        unit: ex.unit,
        weight: ex.weight,
      }))

    const result = await onCreate({
      name: programName.trim(),
      exercises: payloadExercises,
    })

    if (!result.ok) {
      setError(result.error ?? tx.createError)
    }

    setLoading(false)
  }

  return (
    <div className="my-auto space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="text-sm font-semibold text-neutral-100">{tx.title}</div>
        <div className="mt-3">
          <div className="text-xs text-neutral-400">{tx.programName}</div>
          <input
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
        </div>
      </div>

      {catalogLoading ? <div className="text-xs text-neutral-400">{tx.loadingExercises}</div> : null}
      {catalogError ? <div className="text-xs text-red-200 break-words">{catalogError}</div> : null}

      <div className="space-y-3">
        {exercises.map((ex, index) => (
          <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={exercises.length <= 1}
                  onClick={() => removeExercise(index)}
                  className="h-8 rounded-xl border border-red-400/30 bg-red-500/15 px-2 text-[11px] font-semibold text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {tx.delete}
                </button>
                <button
                  type="button"
                  onClick={() => duplicateExercise(index)}
                  className="h-8 rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-neutral-100 transition hover:bg-white/10"
                >
                  {tx.duplicate}
                </button>
              </div>

              <select
                value={ex.catalogExerciseId == null ? "" : String(ex.catalogExerciseId)}
                onChange={(e) => selectExercise(index, e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              >
                <option value="">{tx.selectExercise}</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {trExerciseName(item.label)}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                {(ex.catalogKey === "custom_time" || ex.catalogKey === "custom_reps") ? (
                  <input
                    value={ex.name}
                    onChange={(e) => updateExercise(index, { name: e.target.value })}
                    placeholder={tx.customName}
                    className="col-span-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                  />
                ) : null}
                <input
                  type="number"
                  inputMode="numeric"
                  value={String(ex.target)}
                  onChange={(e) => {
                    const raw = Number(e.target.value) || 0
                    const safeTarget = ex.catalogKey === "custom_reps" ? Math.max(10, raw) : Math.max(0, raw)
                    updateExercise(index, { target: safeTarget })
                  }}
                  placeholder={
                    ex.catalogKey === "custom_time"
                      ? tx.customTargetMinutes
                      : ex.catalogKey === "custom_reps"
                        ? tx.customTargetReps
                        : undefined
                  }
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
                <input
                  value={ex.unit === "steps" ? tx.steps : ex.unit === "minutes" ? tx.minutes : tx.reps}
                  readOnly
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-300 outline-none"
                />
              </div>
              {ex.catalogKey === "custom_time" ? (
                <div className="text-[11px] text-neutral-400">{tx.customTimeHint}</div>
              ) : null}
              {ex.catalogKey === "custom_reps" ? (
                <div className="text-[11px] text-neutral-400">{tx.fullCompletionHint}</div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={addExercise}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            {tx.addExercise}
          </button>
          <button
            type="button"
            disabled={!canCreate || loading}
            onClick={submit}
            className={`h-11 rounded-2xl px-4 text-sm font-semibold transition active:scale-[0.99] ${
              canCreate && !loading
                ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                : "border border-white/10 bg-white/5 text-neutral-500"
            }`}
          >
            {tx.createProgram}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            {tx.back}
          </button>
          {loading ? <div className="text-xs text-neutral-400">{tx.creating}</div> : null}
          {error ? <div className="text-xs text-red-200 break-words">{error}</div> : null}
        </div>
      </div>
    </div>
  )
}
