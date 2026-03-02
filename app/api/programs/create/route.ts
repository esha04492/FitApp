import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_KEY = SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_MODE = SERVICE_ROLE_KEY ? "service_role" : "anon"

type CreateBody = {
  userId?: string
  name?: string
  exercises?: Array<{
    catalogExerciseId?: number
    name?: string
    target?: number
  }>
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
          catalogExerciseId: Number(x.catalogExerciseId) || null,
          name: String(x.name ?? "").trim(),
          target: Math.max(1, Number(x.target) || 0),
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

    let createdProgram: { id: string | number } | null = null
    let programErr: { message?: string } | null = null

    const programInsertAttempts: Array<Record<string, unknown>> = [
      { name, owner_user_id: userId, is_public: false, days_count: 100 },
      { name, owner_user_id: userId, is_public: false },
      { name, owner_user_id: null, is_public: false, days_count: 100 },
      { name, owner_user_id: null, is_public: false },
      { name, owner_user_id: userId },
      { name },
    ]

    for (const payload of programInsertAttempts) {
      const attempt = await supabase.from("programs").insert(payload).select("id").single()
      if (attempt.data?.id != null) {
        createdProgram = { id: attempt.data.id as string | number }
        programErr = null
        break
      }
      if (attempt.error) {
        programErr = attempt.error
      }
    }

    if (programErr || !createdProgram) {
      return NextResponse.json(
        {
          ok: false,
          error: `[${SUPABASE_MODE}] failed to create program: ${programErr?.message ?? "unknown"}`,
        },
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
        {
          ok: false,
          error: `[${SUPABASE_MODE}] ${daysErr?.message ?? "failed to create program days"}`,
        },
        { status: 500 }
      )
    }

    const sortedDays = [...insertedDays].sort((a, b) => a.day_number - b.day_number)

    const rowsReps = sortedDays.flatMap((d) =>
      exercises.map((ex, index) => ({
        program_day_id: d.id,
        catalog_exercise_id: ex.catalogExerciseId,
        name: ex.name,
        target_reps: ex.target,
        sort_order: index + 1,
      }))
    )

    let exerciseInsertError: { message?: string } | null = null
    const exerciseInsertAttempts = [rowsReps]
    for (const attemptRows of exerciseInsertAttempts) {
      const { error } = await supabase.from("day_exercises").insert(attemptRows)
      if (!error) {
        exerciseInsertError = null
        break
      }
      exerciseInsertError = error
    }

    if (exerciseInsertError) {
      return NextResponse.json(
        {
          ok: false,
          error: `[${SUPABASE_MODE}] ${exerciseInsertError.message ?? "failed to create exercises"}`,
        },
        { status: 500 }
      )
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
      // Fallback when onConflict target is not configured in DB.
      const { data: updatedRows, error: updateErr } = await supabase
        .from("user_state")
        .update({ program_id: programId, current_day: 1 })
        .eq("user_id", userId)
        .select("user_id")
        .limit(1)

      if (updateErr) {
        return NextResponse.json(
          { ok: false, error: `[${SUPABASE_MODE}] failed to update user_state: ${updateErr.message}` },
          { status: 500 }
        )
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertStateErr } = await supabase
          .from("user_state")
          .insert({ user_id: userId, program_id: programId, current_day: 1 })
        if (insertStateErr) {
          return NextResponse.json(
            { ok: false, error: `[${SUPABASE_MODE}] failed to create user_state: ${insertStateErr.message}` },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({ ok: true, programId })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
