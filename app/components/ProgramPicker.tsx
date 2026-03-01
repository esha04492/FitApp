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
          Welcome!
          <br />
          Choose a program or create your own
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          disabled={loading}
          onClick={onPickBuiltIn}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
        >
          <div className="text-base font-semibold text-neutral-100">100 days v.2</div>
          <div className="mt-1 text-xs text-neutral-400">Built-in program</div>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={onPickCustom}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
        >
          <div className="text-base font-semibold text-neutral-100">Create your own</div>
          <div className="mt-1 text-xs text-neutral-400">Your custom workout plan</div>
        </button>
      </div>
    </div>
  )
}
