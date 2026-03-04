import { NextResponse } from "next/server"
import {
  getTodayLocalISO,
  loadTelegramRecipients,
  markTelegramUserError,
  markTelegramUserInactive,
  sendTelegramMessage,
} from "../reminders/_lib"

export const runtime = "nodejs"

const REMIND_SECRET = process.env.REMIND_SECRET
const MINIAPP_URL = process.env.MINIAPP_URL ?? process.env.WEBAPP_URL

type Reason = "bad_secret" | "missing_env" | "no_users" | "db_error" | "telegram_error" | "exception" | ""

export async function GET(req: Request) {
  const errors: string[] = []
  const today = getTodayLocalISO()
  const base = { totalUsers: 0, reminded: 0, errors }

  const missingEnv: string[] = []
  if (!process.env.REMIND_SECRET) missingEnv.push("REMIND_SECRET")
  if (!process.env.BOT_TOKEN) missingEnv.push("BOT_TOKEN")
  if (!(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)) missingEnv.push("SUPABASE_URL")
  if (!(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    missingEnv.push("SUPABASE_SERVICE_ROLE_KEY_OR_ANON")
  }
  if (!MINIAPP_URL) missingEnv.push("MINIAPP_URL_OR_WEBAPP_URL")

  try {
    const secret = new URL(req.url).searchParams.get("secret")
    if (!REMIND_SECRET || secret !== REMIND_SECRET) {
      return NextResponse.json({ ok: false, reason: "bad_secret" as Reason, ...base }, { status: 401 })
    }

    if (missingEnv.length > 0) {
      return NextResponse.json({
        ok: false,
        reason: "missing_env" as Reason,
        details: { missing: missingEnv },
        ...base,
      })
    }

    const { recipients, error, supabase } = await loadTelegramRecipients()
    if (error) {
      return NextResponse.json({
        ok: false,
        reason: "db_error" as Reason,
        details: error,
        ...base,
      })
    }

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, reason: "no_users" as Reason, totalUsers: 0, reminded: 0, errors })
    }

    let reminded = 0
    const text = "Don't break the streak 💪 Log today's workout in FitStreak."

    for (const recipient of recipients) {
      if (!recipient.active) continue

      const sent = await sendTelegramMessage({
        chat_id: recipient.chatId,
        text,
        reply_markup: {
          inline_keyboard: [[{ text: "Open app", web_app: { url: MINIAPP_URL } }]],
        },
      })

      if (sent.ok) {
        reminded += 1
        continue
      }

      const sendReason = sent.description
      errors.push(`daily send failed for ${recipient.userId}: ${sendReason}`)
      if (sent.chatNotFound) {
        await markTelegramUserInactive(supabase, recipient.userId, sendReason)
      } else {
        await markTelegramUserError(supabase, recipient.userId, sendReason)
      }
    }

    if (errors.length > 0 && reminded === 0) {
      return NextResponse.json({
        ok: false,
        reason: "telegram_error" as Reason,
        totalUsers: recipients.length,
        reminded,
        today,
        errors,
      })
    }

    return NextResponse.json({
      ok: true,
      reason: (errors.length > 0 ? "telegram_error" : "") as Reason,
      totalUsers: recipients.length,
      reminded,
      today,
      errors,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown"
    return NextResponse.json({
      ok: false,
      reason: "exception" as Reason,
      details: message,
      ...base,
    })
  }
}
