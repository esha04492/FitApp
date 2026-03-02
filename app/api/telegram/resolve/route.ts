import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"

export const runtime = "nodejs"

const BOT_TOKEN = process.env.BOT_TOKEN
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function buildSignature(uid: string, ts: string): string {
  return createHmac("sha256", BOT_TOKEN ?? "").update(`${uid}:${ts}`).digest("hex")
}

export async function GET(req: Request) {
  try {
    if (!BOT_TOKEN) return NextResponse.json({ ok: false, error: "BOT_TOKEN missing" }, { status: 500 })

    const url = new URL(req.url)
    const uid = url.searchParams.get("uid")
    const ts = url.searchParams.get("ts")
    const sig = url.searchParams.get("sig")
    if (!uid || !ts || !sig) return NextResponse.json({ ok: false }, { status: 400 })

    const tsNum = Number(ts)
    if (!Number.isFinite(tsNum)) return NextResponse.json({ ok: false }, { status: 400 })
    const nowSec = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSec - tsNum) > MAX_AGE_SECONDS) return NextResponse.json({ ok: false }, { status: 401 })

    const expected = buildSignature(uid, ts)
    const ok =
      expected.length === sig.length &&
      timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(sig, "utf8"))

    if (!ok) return NextResponse.json({ ok: false }, { status: 401 })

    return NextResponse.json({ ok: true, userId: uid })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

