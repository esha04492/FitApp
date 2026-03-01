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
        totalTgUsers: 0,
        reminded: 0,
        today,
        errors: ["Supabase env is missing"],
      })
    }

    const { data: tgRows, error: tgErr } = await supabase
      .from("telegram_users")
      .select("user_id, chat_id")

    if (tgErr) {
      return NextResponse.json({
        ok: false,
        totalTgUsers: 0,
        reminded: 0,
        today,
        errors: [`telegram_users read error: ${tgErr.message}`],
      })
    }

    const recipients = (tgRows ?? [])
      .map((r) => ({
        userId: r.user_id ? String(r.user_id) : "",
        chatId: r.chat_id ? String(r.chat_id) : "",
      }))
      .filter((r) => r.userId && r.chatId)

    if (recipients.length === 0) {
      return NextResponse.json({
        ok: true,
        totalTgUsers: 0,
        reminded: 0,
        today,
        note: "telegram_users is empty. Users need to press Start in Telegram bot.",
        errors,
      })
    }

    let reminded = 0

    for (const recipient of recipients) {
      const { userId, chatId } = recipient

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
        chat_id: chatId,
        text: "\u23f0 \u0422\u044b \u0435\u0449\u0451 \u043d\u0435 \u043e\u0442\u043c\u0435\u0442\u0438\u043b \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443 \u0441\u0435\u0433\u043e\u0434\u043d\u044f. \u0416\u043c\u0438 \u00ab\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435\u00bb \ud83d\udcaa",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "\ud83d\ude80 \u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u0435",
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
      totalTgUsers: recipients.length,
      reminded,
      today,
      errors,
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      totalTgUsers: 0,
      reminded: 0,
      today,
      errors: [...errors, e?.message ?? "unknown"],
    })
  }
}
