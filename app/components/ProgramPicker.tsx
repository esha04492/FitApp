"use client"
import { useState } from "react"

export default function ProgramPicker(props: {
  onPickBuiltIn: () => Promise<void>
  onPickCustom: () => void
  loading: boolean
  lang: "ru" | "en"
  onLangChange: (lang: "ru" | "en") => void
  labels: {
    welcome: string
    builtInSubtitle: string
    createOwn: string
    customSubtitle: string
    confirmTitle: string
    confirmBody: string
    confirmOk: string
    confirmBack: string
  }
}) {
  const { onPickBuiltIn, onPickCustom, loading, lang, onLangChange, labels } = props
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="my-auto">
      <div className="mb-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onLangChange("ru")}
          className={`h-8 rounded-xl border px-3 text-xs font-semibold transition ${
            lang === "ru" ? "border-white/20 bg-white/10 text-neutral-100" : "border-white/10 bg-white/5 text-neutral-400"
          }`}
        >
          RU
        </button>
        <button
          type="button"
          onClick={() => onLangChange("en")}
          className={`h-8 rounded-xl border px-3 text-xs font-semibold transition ${
            lang === "en" ? "border-white/20 bg-white/10 text-neutral-100" : "border-white/10 bg-white/5 text-neutral-400"
          }`}
        >
          EN
        </button>
      </div>

      <div className="text-center">
        <div className="mt-1 text-2xl font-semibold tracking-tight">{labels.welcome}</div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          disabled={loading}
          onClick={() => setShowConfirm(true)}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
        >
          <div className="text-base font-semibold text-neutral-100">100 days Advanced</div>
          <div className="mt-1 text-xs text-neutral-400">{labels.builtInSubtitle}</div>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={onPickCustom}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur transition hover:bg-white/10 active:scale-[0.99] disabled:opacity-60"
        >
          <div className="text-base font-semibold text-neutral-100">{labels.createOwn}</div>
          <div className="mt-1 text-xs text-neutral-400">{labels.customSubtitle}</div>
        </button>
      </div>

      {showConfirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900 px-5 py-4 shadow-2xl">
            <div className="text-base font-semibold text-neutral-100">{labels.confirmTitle}</div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-neutral-300">{labels.confirmBody}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  setShowConfirm(false)
                  await onPickBuiltIn()
                }}
                className="h-11 w-full rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-100 transition active:scale-[0.99] hover:bg-emerald-500/25"
              >
                {labels.confirmOk}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-neutral-100 transition active:scale-[0.99] hover:bg-white/10"
              >
                {labels.confirmBack}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
