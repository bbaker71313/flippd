import { supabase } from './supabase'
import type { GrowthReport } from '@sfp/shared'

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

export type GrowthReportResult = {
  cached: boolean
  data: GrowthReport
  generatedAt: string
}

export async function fetchGrowthReport(forceRefresh = false): Promise<GrowthReportResult> {
  const result = await callProxy({ type: 'growth_report', forceRefresh })
  return {
    cached:      Boolean(result.cached),
    data:        result.data as unknown as GrowthReport,
    generatedAt: result.generatedAt as string,
  }
}
