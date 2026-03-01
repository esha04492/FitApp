import { NextResponse } from "next/server"

export const runtime = "nodejs" // важно для fetch + crypto в node runtime

const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
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