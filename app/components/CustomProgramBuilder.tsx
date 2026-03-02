"use client"
import { useEffect, useMemo, useState } from "react"
import { loadExerciseCatalog, type CatalogExercise } from "../lib/catalog"

export type BuilderExercise = {
  catalogExerciseId: number
  name: string
  target: number
  unit: "reps" | "steps"
  weight: number
}

export default function CustomProgramBuilder(props: {
  onBack: () => void
  onCreate: (payload: { name: string; exercises: BuilderExercise[] }) => Promise<{ ok: boolean; error?: string }>
  lang?: "ru" | "en"
}) {
  const { onBack, onCreate, lang = "ru" } = props

  const [programName, setProgramName] = useState("My program")
  const [catalog, setCatalog] = useState<CatalogExercise[]>([])
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [exercises, setExercises] = useState<
    Array<{
      catalogExerciseId: number | null
      name: string
      target: number
      unit: "reps" | "steps"
      weight: number
    }>
  >([{ catalogExerciseId: null, name: "", target: 0, unit: "reps", weight: 1 }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    patch: Partial<{ catalogExerciseId: number | null; name: string; target: number; unit: "reps" | "steps"; weight: number }>
  ) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  const addExercise = () => {
    setExercises((prev) => [...prev, { catalogExerciseId: null, name: "", target: 0, unit: "reps", weight: 1 }])
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
      updateExercise(index, { catalogExerciseId: null, name: "", unit: "reps", target: 0, weight: 1 })
      return
    }

    const selected = catalog.find((x) => x.id === selectedId)
    if (!selected) return

    const duplicateIndex = exercises.findIndex((x, i) => i !== index && x.catalogExerciseId === selected.id)
    if (duplicateIndex !== -1) {
      setError("This exercise is already selected")
      return
    }

    setError(null)
    setExercises((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              catalogExerciseId: selected.id,
              name: selected.label,
              unit: selected.unit,
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
        name: ex.name.trim(),
        target: Math.max(1, Number(ex.target) || 0),
        unit: ex.unit,
        weight: ex.weight,
      }))

    const result = await onCreate({
      name: programName.trim(),
      exercises: payloadExercises,
    })

    if (!result.ok) {
      setError(result.error ?? "Could not create program")
    }

    setLoading(false)
  }

  return (
    <div className="my-auto space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="text-sm font-semibold text-neutral-100">Create your plan</div>
        <div className="mt-3">
          <div className="text-xs text-neutral-400">Program name</div>
          <input
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
        </div>
      </div>

      {catalogLoading ? <div className="text-xs text-neutral-400">Loading exercises...</div> : null}
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
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => duplicateExercise(index)}
                  className="h-8 rounded-xl border border-white/10 bg-white/5 px-2 text-[11px] font-semibold text-neutral-100 transition hover:bg-white/10"
                >
                  Duplicate
                </button>
              </div>

              <select
                value={ex.catalogExerciseId == null ? "" : String(ex.catalogExerciseId)}
                onChange={(e) => selectExercise(index, e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              >
                <option value="">Select exercise</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {trExerciseName(item.label)}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={String(ex.target)}
                  onChange={(e) => updateExercise(index, { target: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
                <input
                  value={ex.unit}
                  readOnly
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-300 outline-none"
                />
              </div>
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
            Add exercise
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
            Create program
          </button>
          <button
            type="button"
            onClick={onBack}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            Back
          </button>
          {loading ? <div className="text-xs text-neutral-400">Creating...</div> : null}
          {error ? <div className="text-xs text-red-200 break-words">{error}</div> : null}
        </div>
      </div>
    </div>
  )
}
