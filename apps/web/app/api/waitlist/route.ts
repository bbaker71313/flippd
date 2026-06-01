import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://dqgfpchkheznvanfgsmx.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZ2ZwY2hraGV6bnZhbmZnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjE5MjQsImV4cCI6MjA5MzEzNzkyNH0.mAViqTT9u5_iXikax9ZOr9b2i9UzecrGiY9kLI-Egdo'

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { error } = await supabase
      .from('waitlist')
      .insert({ email, created_at: new Date().toISOString() })

    // Unique constraint violation = already on list = treat as success
    if (error && error.code === '23505') {
      return NextResponse.json({ ok: true })
    }

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[waitlist]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
