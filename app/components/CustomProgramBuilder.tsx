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

  const submit = async () => {
    if (!canCreate || loading) return
    setLoading(true)
    setError(null)
    const result = await onCreate({
      name: programName.trim(),
      exercises: exercises.map((ex) => ({ ...ex, name: ex.name.trim() })),
    })
    if (!result.ok) {
      setError(result.error ?? "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С—РЎР‚Р С•Р С–РЎР‚Р В°Р СР СРЎС“")
    }
    setLoading(false)
  }

  return (
    <div className="my-auto space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="text-sm font-semibold text-neutral-100">Р РЋР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ РЎРѓР Р†Р С•РЎР‹</div>
        <div className="mt-3">
          <div className="text-xs text-neutral-400">Р СњР В°Р В·Р Р†Р В°Р Р…Р С‘Р Вµ Р С—РЎР‚Р С•Р С–РЎР‚Р В°Р СР СРЎвЂ№</div>
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
              <input
                value={ex.name}
                onChange={(e) => updateExercise(index, { name: e.target.value })}
                placeholder="Р Р€Р С—РЎР‚Р В°Р В¶Р Р…Р ВµР Р…Р С‘Р Вµ"
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
            Р вЂќР С•Р В±Р В°Р Р†Р С‘РЎвЂљРЎРЉ РЎС“Р С—РЎР‚Р В°Р В¶Р Р…Р ВµР Р…Р С‘Р Вµ
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
            Р РЋР С•Р В·Р Т‘Р В°РЎвЂљРЎРЉ Р С—РЎР‚Р С•Р С–РЎР‚Р В°Р СР СРЎС“
          </button>
          <button
            onClick={onBack}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
          >
            Р СњР В°Р В·Р В°Р Т‘
          </button>
          {loading ? <div className="text-xs text-neutral-400">Р РЋР С•Р В·Р Т‘Р В°Р Р…Р С‘Р Вµ...</div> : null}
          {error ? <div className="text-xs text-red-200 break-words">{error}</div> : null}
        </div>
      </div>
    </div>
  )
}
