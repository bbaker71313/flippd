import { supabase } from './supabase'
import type { PnlSummary, PnlExpense } from '@sfp/shared'

function getProxyUrl(): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claude-proxy`
}

async function callProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Session expired. Please sign in again.')
  const res = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((d.error as string) ?? `Server error (${res.status})`)
  }
  return res.json()
}

export type Period = 'month' | 'last30' | 'all'

export async function fetchStatsSummary(period: Period): Promise<PnlSummary> {
  const result = await callProxy({ type: 'stats_summary', period })
  return result.summary as PnlSummary
}

function mapExpense(row: Record<string, unknown>): PnlExpense {
  return {
    id:          row.id as number,
    userId:      row.user_id as number,
    amount:      Number(row.amount ?? 0),
    description: row.description as string | null,
    category:    (row.category as PnlExpense['category']) ?? 'other',
    expenseDate: row.date as string,
    miles:       row.miles != null ? Number(row.miles) : null,
    createdAt:   row.created_at as string,
  }
}

export async function fetchExpenses(): Promise<PnlExpense[]> {
  const result = await callProxy({ type: 'expenses_list' })
  return ((result.expenses as unknown[]) ?? []).map(r => mapExpense(r as Record<string, unknown>))
}

export async function addExpense(input: {
  amount: number
  category: PnlExpense['category']
  description?: string
  date?: string
  miles?: number
}): Promise<PnlExpense> {
  const result = await callProxy({ type: 'expenses_add', ...input })
  return mapExpense(result.expense as Record<string, unknown>)
}

function getCheckoutUrl(): string {
  return `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/stripe-checkout`
}

export async function createCheckoutSession(tier: 'hustle' | 'stack' | 'empire'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(getCheckoutUrl(), {
    method: 'POST',
    headers: {
      'Authorization': session ? `Bearer ${session.access_token}` : '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tier, interval: 'monthly', userId: session?.user.id }),
  })
  if (!res.ok) {
    const d = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error((d.error as string) ?? 'Could not create checkout session')
  }
  const data = await res.json() as { url: string }
  return data.url
}
