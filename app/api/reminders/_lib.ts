import { createClient } from "@supabase/supabase-js"

export type TgRecipient = {
  userId: string
  chatId: string
  active: boolean
}

const BOT_TOKEN = process.env.BOT_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export function getTodayLocalISO() {
  return new Date().toLocaleDateString("sv-SE")
}

export function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_KEY)
}

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN}/${method}`
}

export async function loadTelegramRecipients() {
  const supabase = getSupabase()
  if (!supabase) return { recipients: [] as TgRecipient[], error: "Supabase env is missing", supabase: null }

  const withFlags = await supabase
    .from("telegram_users")
    .select("user_id,chat_id,telegram_id,is_active")
  if (withFlags.error) {
    const fallback = await supabase.from("telegram_users").select("user_id,chat_id")
    if (fallback.error) {
      return { recipients: [] as TgRecipient[], error: fallback.error.message, supabase }
    }
    const recipients = (fallback.data ?? [])
      .map((row) => ({
        userId: String(row.user_id ?? ""),
        chatId: String(row.chat_id ?? ""),
        active: true,
      }))
      .filter((r) => r.userId && r.chatId)
    return { recipients, error: null as string | null, supabase }
  }

  const recipients = (withFlags.data ?? [])
    .map((row) => {
      const userId = String(row.user_id ?? "")
      const chatId = String(row.chat_id ?? "")
      const telegramIdRaw = row.telegram_id == null ? "" : String(row.telegram_id)
      const isActive = row.is_active == null ? true : Boolean(row.is_active)
      const hasTelegramIdOrChat = Boolean(telegramIdRaw) || Boolean(chatId)
      return { userId, chatId, active: isActive && hasTelegramIdOrChat }
    })
    .filter((r) => r.userId && r.chatId)

  return { recipients, error: null as string | null, supabase }
}

export async function markTelegramUserInactive(supabase: ReturnType<typeof getSupabase>, userId: string, reason: string) {
  if (!supabase) return
  const now = new Date().toISOString()
  const attempts: Array<Record<string, unknown>> = [
    { is_active: false, last_error: reason, updated_at: now },
    { is_active: false, updated_at: now },
    { last_error: reason, updated_at: now },
  ]
  for (const payload of attempts) {
    const { error } = await supabase.from("telegram_users").update(payload).eq("user_id", userId)
    if (!error) return
  }
}

export async function markTelegramUserError(supabase: ReturnType<typeof getSupabase>, userId: string, reason: string) {
  if (!supabase) return
  const now = new Date().toISOString()
  const attempts: Array<Record<string, unknown>> = [
    { last_error: reason, updated_at: now },
    { updated_at: now },
  ]
  for (const payload of attempts) {
    const { error } = await supabase.from("telegram_users").update(payload).eq("user_id", userId)
    if (!error) return
  }
}

export async function sendTelegramMessage(payload: { chat_id: string; text: string; reply_markup?: unknown }) {
  if (!BOT_TOKEN) {
    return { ok: false, description: "BOT_TOKEN missing", chatNotFound: false }
  }
  const res = await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  const ok = res.ok && body?.ok === true
  const description = String(body?.description ?? res.statusText ?? "sendMessage failed")
  const chatNotFound = description.toLowerCase().includes("chat not found")
  return { ok, description, chatNotFound }
}

export function supportMilestones() {
  return new Set([2, 10, 20])
}
