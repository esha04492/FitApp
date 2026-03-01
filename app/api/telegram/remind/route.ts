import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const REMIND_SECRET = process.env.REMIND_SECRET

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
}

function getTodayLocalISO() {
  return new Date().toLocaleDateString("sv-SE")
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

export async function GET(req: Request) {
  const today = getTodayLocalISO()
  const errors: string[] = []

  try {
    const secret = new URL(req.url).searchParams.get("secret")
    if (!REMIND_SECRET || secret !== REMIND_SECRET) {
      return NextResponse.json({ ok: false }, { status: 401 })
    }

    const supabase = getSupabase()
    if (!supabase) {
      return NextResponse.json({
        ok: false,
        totalUsers: 0,
        reminded: 0,
        today,
        errors: ["Supabase env is missing"],
      })
    }

    const { data: stateRows, error: stateErr } = await supabase.from("user_state").select("user_id")
    if (stateErr) {
      return NextResponse.json({
        ok: false,
        totalUsers: 0,
        reminded: 0,
        today,
        errors: [`user_state read error: ${stateErr.message}`],
      })
    }

    const userIds = [...new Set((stateRows ?? []).map((r) => String(r.user_id)).filter(Boolean))]

    let reminded = 0
    for (const userId of userIds) {
      const { data: closedRows, error: closedErr } = await supabase
        .from("user_day_history")
        .select("user_id")
        .eq("user_id", userId)
        .eq("local_date", today)
        .eq("skipped", false)
        .limit(1)

      if (closedErr) {
        errors.push(`history check failed for ${userId}: ${closedErr.message}`)
        continue
      }

      const closedToday = (closedRows ?? []).length > 0
      if (closedToday) continue

      if (!BOT_TOKEN || !WEBAPP_URL) {
        errors.push(`telegram env missing for ${userId}`)
        continue
      }

      const payload = {
        chat_id: userId,
        text: "⏰ Ты ещё не отметил тренировку сегодня. Жми «Открыть приложение» 💪",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Открыть приложение",
                web_app: { url: WEBAPP_URL },
              },
            ],
          ],
        },
      }

      try {
        const tgRes = await fetch(apiUrl("sendMessage"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        })

        const tgBody = await tgRes.json().catch(() => ({}))
        if (!tgRes.ok || tgBody?.ok !== true) {
          errors.push(`telegram send failed for ${userId}: ${tgBody?.description ?? tgRes.statusText}`)
          continue
        }

        reminded += 1
      } catch (e: any) {
        errors.push(`telegram fetch failed for ${userId}: ${e?.message ?? "unknown"}`)
      }
    }

    return NextResponse.json({
      ok: true,
      totalUsers: userIds.length,
      reminded,
      today,
      errors,
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      totalUsers: 0,
      reminded: 0,
      today,
      errors: [...errors, e?.message ?? "unknown"],
    })
  }
}

