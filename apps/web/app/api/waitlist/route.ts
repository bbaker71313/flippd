import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dqgfpchkheznvanfgsmx.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function sendWaitlistWelcome(email: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://scanforprofit.com'
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? 'ScanForProfit <hello@scanforprofit.com>',
      to: [email],
      subject: "You're on the list — ScanForProfit early access",
      html: `<h2>You're on the list!</h2>
<p>Thanks for signing up for ScanForProfit early access. We'll email you the moment your spot opens up.</p>
<p>In the meantime, the app is already live — you can start scanning today:</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Try ScanForProfit Now &rarr;</a></p>
<p style="color:#888;font-size:12px;">Questions? Reply to this email — we read every one.</p>`,
    }),
  })
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_ANON_KEY) {
      console.error('[waitlist] NEXT_PUBLIC_SUPABASE_ANON_KEY not configured')
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    const { email, source } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { error } = await supabase
      .from('waitlist')
      .insert({ email, source: source ?? 'landing-page', created_at: new Date().toISOString() })

    // Unique constraint — already on list, still send response as success
    if (error && error.code !== '23505') throw error

    // Fire welcome email (non-blocking — don't fail the response if it errors)
    sendWaitlistWelcome(email).catch(console.error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[waitlist]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
