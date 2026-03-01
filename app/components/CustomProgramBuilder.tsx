"use client"
import { useMemo, useState } from "react"

type BuilderExercise = {
  name: string
  target: number
  unit: "reps" | "steps"
}

export default function CustomProgramBuilder(props: {
  onBack: () => void
  onCreate: (payload: { name: string; exercises: BuilderExercise[] }) => Promise<{ ok: boolean; error?: string }>
}) {
  const { onBack, onCreate } = props

  const [programName, setProgramName] = useState("My program")
  const [exercises, setExercises] = useState<BuilderExercise[]>([{ name: "", target: 10, unit: "reps" }])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canCreate = useMemo(() => {
    if (!programName.trim()) return false
    if (exercises.length === 0) return false
    return exercises.every((ex) => ex.name.trim().length > 0 && ex.target > 0)
  }, [programName, exercises])

  const updateExercise = (index: number, patch: Partial<BuilderExercise>) => {
    setExercises((prev) => prev.map((ex, i) => (i === index ? { ...ex, ...patch } : ex)))
  }

  const addExercise = () => {
    setExercises((prev) => [...prev, { name: "", target: 10, unit: "reps" }])
  }

  const removeExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index))
  }

  const submit = async () => {
    if (!canCreate || loading) return
    setLoading(true)
    setError(null)
    const result = await onCreate({
      name: programName.trim(),
      exercises: exercises.map((ex) => ({ ...ex, name: ex.name.trim() })),
    })
    if (!result.ok) {
      setError(result.error ?? "Не удалось создать программу")
    }
    setLoading(false)
  }

  return (
    <div className="my-auto space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="text-sm font-semibold text-neutral-100">Создать свою</div>
        <div className="mt-3">
          <div className="text-xs text-neutral-400">Название программы</div>
          <input
            value={programName}
            onChange={(e) => setProgramName(e.target.value)}
            className="mt-1 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
          />
        </div>
      </div>

      <div className="space-y-3">
        {exercises.map((ex, index) => (
          <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="grid grid-cols-1 gap-2">
              <input
                value={ex.name}
                onChange={(e) => updateExercise(index, { name: e.target.value })}
                placeholder="Упражнение"
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  value={String(ex.target)}
                  onChange={(e) => updateExercise(index, { target: Math.max(0, Number(e.target.value) || 0) })}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                />
                <select
                  value={ex.unit}
                  onChange={(e) => updateExercise(index, { unit: e.target.value as "reps" | "steps" })}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-neutral-100 outline-none focus:border-white/20 focus:ring-2 focus:ring-white/10"
                >
                  <option value="reps">reps</option>
                  <option value="steps">steps</option>
                </select>
              </div>
              {index > 0 ? (
                <button
                  onClick={() => removeExercise(index)}
                  className="h-10 rounded-2xl border border-red-400/20 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition active:scale-[0.99] hover:bg-red-500/15"
                >
                  Удалить упражнение
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={addExercise}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            Добавить упражнение
          </button>
          <button
            disabled={!canCreate || loading}
            onClick={submit}
            className={`h-11 rounded-2xl px-4 text-sm font-semibold transition active:scale-[0.99] ${
              canCreate && !loading
                ? "border border-emerald-400/20 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                : "border border-white/10 bg-white/5 text-neutral-500"
            }`}
          >
            Создать программу
          </button>
          <button
            onClick={onBack}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            Назад
          </button>
          {loading ? <div className="text-xs text-neutral-400">Создание...</div> : null}
          {error ? <div className="text-xs text-red-200">{error}</div> : null}
        </div>
      </div>
    </div>
  )
}