import { NextResponse } from "next/server"
import { getTodayLocalISO, loadTelegramRecipients, markTelegramUserError, markTelegramUserInactive, sendTelegramMessage } from "../reminders/_lib"

export const runtime = "nodejs"

const REMIND_SECRET = process.env.REMIND_SECRET
const MINIAPP_URL = process.env.MINIAPP_URL ?? process.env.WEBAPP_URL

export async function GET(req: Request) {
  const errors: string[] = []
  const today = getTodayLocalISO()

  const secret = new URL(req.url).searchParams.get("secret")
  if (!REMIND_SECRET || secret !== REMIND_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const { recipients, error, supabase } = await loadTelegramRecipients()
  if (error) {
    return NextResponse.json({ ok: false, totalUsers: 0, reminded: 0, errors: [error] })
  }

  let reminded = 0
  const text = "Don’t break the streak 💪 Log today’s workout in FitStreak."

  for (const recipient of recipients) {
    if (!recipient.active) continue
    if (!MINIAPP_URL) {
      errors.push("MINIAPP_URL (or WEBAPP_URL) missing")
      break
    }

    const sent = await sendTelegramMessage({
      chat_id: recipient.chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open app",
              web_app: { url: MINIAPP_URL },
            },
          ],
        ],
      },
    })

    if (sent.ok) {
      reminded += 1
      continue
    }

    const reason = sent.description
    errors.push(`daily send failed for ${recipient.userId}: ${reason}`)
    if (sent.chatNotFound) {
      await markTelegramUserInactive(supabase, recipient.userId, reason)
    } else {
      await markTelegramUserError(supabase, recipient.userId, reason)
    }
  }

  return NextResponse.json({
    ok: true,
    totalUsers: recipients.length,
    reminded,
    today,
    errors,
  })
}
