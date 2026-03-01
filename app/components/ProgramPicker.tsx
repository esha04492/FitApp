"use client"

export default function ProgramPicker(props: {
  onPickBuiltIn: () => Promise<void>
  onPickCustom: () => void
  loading: boolean
}) {
  const { onPickBuiltIn, onPickCustom, loading } = props

  return (
    <div className="my-auto">
      <div className="text-center">
        <div className="mt-1 text-2xl font-semibold tracking-tight">
          Добро пожаловать!
          <br />
          Выбери программу или создай свою
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          disabled={loading}
          onClick={onPickBuiltIn}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
        >
          <div className="text-base font-semibold text-neutral-100">100 days v.2</div>
          <div className="mt-1 text-xs text-neutral-400">Встроенная программа</div>
        </button>

        <button
          disabled={loading}
          onClick={onPickCustom}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
        >
          <div className="text-base font-semibold text-neutral-100">Создать свою</div>
          <div className="mt-1 text-xs text-neutral-400">Свой план тренировок</div>
        </button>
      </div>
    </div>
  )
}

