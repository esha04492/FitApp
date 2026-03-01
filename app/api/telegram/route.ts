import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs" // важно для fetch + crypto в node runtime

const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

export async function POST(req: Request) {
  try {
    if (!BOT_TOKEN || !WEBAPP_URL) {
      return NextResponse.json({ ok: false, error: "BOT_TOKEN or WEBAPP_URL missing" }, { status: 500 })
    }

    const update = await req.json()

    const message = update.message || update.edited_message
    if (!message) return NextResponse.json({ ok: true })

    const chatId = message.chat?.id
    const text: string = message.text || ""

    // реагируем на /start
    if (chatId && text.startsWith("/start")) {
      const tgUserId = message.from?.id ? String(message.from.id) : null
      const username = message.from?.username ?? null
      const firstName = message.from?.first_name ?? null
      const lastName = message.from?.last_name ?? null

      if (tgUserId) {
        const supabase = getSupabase()
        if (!supabase) {
          console.error("telegram /start upsert skipped: supabase env missing")
        } else {
          const { error: upsertErr } = await supabase.from("telegram_users").upsert({
            user_id: tgUserId,
            chat_id: chatId,
            username: username,
            first_name: firstName,
            last_name: lastName,
            updated_at: new Date().toISOString(),
          })
          if (upsertErr) {
            console.error("telegram /start upsert error:", upsertErr.message)
          }
        }
      }

      const payload = {
        chat_id: chatId,
        text:
          "🔥 Добро пожаловать в FitStreak!\n\n" +
          "Сможешь продержаться 100 дней подряд?\n\n" +
          "Жми кнопку ниже и начинай сегодня 💪",
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

      await fetch(apiUrl("sendMessage"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "unknown" }, { status: 200 })
  }
  
}
export async function GET() {
  return Response.json({ ok: true, hint: "Telegram webhook endpoint. Send POST updates here." })
}
