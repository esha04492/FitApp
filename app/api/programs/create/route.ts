import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type CreateBody = {
  userId?: string
  name?: string
  exercises?: Array<{ name?: string; target?: number; unit?: "reps" | "steps" }>
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

export async function POST(req: Request) {
  try {
    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase env is missing" }, { status: 500 })
    }

    const body = (await req.json()) as CreateBody
    const userId = String(body.userId ?? "").trim()
    const name = String(body.name ?? "").trim()
    const exercises =
      body.exercises
        ?.map((x) => ({
          name: String(x.name ?? "").trim(),
          target: Math.max(1, Number(x.target) || 0),
          unit: x.unit === "steps" ? "steps" : "reps",
        }))
        .filter((x) => x.name.length > 0) ?? []

    if (!userId) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 })
    }
    if (exercises.length === 0) {
      return NextResponse.json({ ok: false, error: "at least one exercise is required" }, { status: 400 })
    }

    const { data: createdProgram, error: programErr } = await supabase
      .from("programs")
      .insert({
        name,
        owner_user_id: userId,
        is_public: false,
        days_count: 100,
      })
      .select("id")
      .single()

    if (programErr || !createdProgram) {
      return NextResponse.json(
        { ok: false, error: programErr?.message ?? "failed to create program" },
        { status: 500 }
      )
    }

    const programId = createdProgram.id as string | number

    const dayRows = Array.from({ length: 100 }, (_, i) => ({
      program_id: programId,
      day_number: i + 1,
    }))

    const { data: insertedDays, error: daysErr } = await supabase
      .from("program_days")
      .insert(dayRows)
      .select("id,day_number")

    if (daysErr || !insertedDays?.length) {
      return NextResponse.json(
        { ok: false, error: daysErr?.message ?? "failed to create program days" },
        { status: 500 }
      )
    }

    const sortedDays = [...insertedDays].sort((a, b) => a.day_number - b.day_number)

    const rowsReps = sortedDays.flatMap((d) =>
      exercises.map((ex, index) => ({
        program_day_id: d.id,
        name: ex.name,
        target_reps: ex.target,
        sort_order: index + 1,
      }))
    )

    const { error: exErr1 } = await supabase.from("day_exercises").insert(rowsReps)
    if (exErr1) {
      const rowsAlt = sortedDays.flatMap((d) =>
        exercises.map((ex, index) => ({
          program_day_id: d.id,
          name: ex.name,
          target: ex.target,
          unit: ex.unit,
          weight: null,
          sort_order: index + 1,
        }))
      )

      const { error: exErr2 } = await supabase.from("day_exercises").insert(rowsAlt)
      if (exErr2) {
        return NextResponse.json(
          { ok: false, error: exErr2.message ?? exErr1.message ?? "failed to create exercises" },
          { status: 500 }
        )
      }
    }

    const { error: stateErr } = await supabase.from("user_state").upsert(
      {
        user_id: userId,
        program_id: programId,
        current_day: 1,
      },
      { onConflict: "user_id" }
    )

    if (stateErr) {
      return NextResponse.json(
        { ok: false, error: stateErr.message ?? "failed to update user_state" },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, programId })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
