import { NextResponse } from "next/server"
import {
  getTodayLocalISO,
  getSupabase,
  loadTelegramRecipients,
  markTelegramUserError,
  markTelegramUserInactive,
  sendTelegramMessage,
  supportMilestones,
} from "../reminders/_lib"

export const runtime = "nodejs"

const REMIND_SECRET = process.env.REMIND_SECRET
const BOOSTY_URL = process.env.BOOSTY_URL ?? "https://boosty.to/fitstreak/purchase/3827839?ssource=DIRECT&share=subscription_link"

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

  const db = getSupabase()
  if (!db) {
    return NextResponse.json({ ok: false, totalUsers: recipients.length, reminded: 0, errors: ["Supabase env is missing"] })
  }

  const userIds = recipients.map((r) => r.userId)
  const { data: stateRows, error: stateErr } = await db
    .from("user_state")
    .select("user_id,current_day")
    .in("user_id", userIds)

  if (stateErr) {
    return NextResponse.json({ ok: false, totalUsers: recipients.length, reminded: 0, errors: [stateErr.message] })
  }

  const milestoneSet = supportMilestones()
  const stateByUser = new Map<string, number>()
  ;(stateRows ?? []).forEach((row) => {
    stateByUser.set(String(row.user_id), Number(row.current_day) || 0)
  })

  let reminded = 0
  const text = "If FitStreak helps you — support the project ❤️"

  for (const recipient of recipients) {
    if (!recipient.active) continue
    const currentDay = stateByUser.get(recipient.userId) ?? 0
    if (!milestoneSet.has(currentDay)) continue

    const sent = await sendTelegramMessage({
      chat_id: recipient.chatId,
      text,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Support on Boosty",
              url: BOOSTY_URL,
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
    errors.push(`support send failed for ${recipient.userId}: ${reason}`)
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
