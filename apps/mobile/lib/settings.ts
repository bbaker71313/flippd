import { supabase } from './supabase'
import type { UserSettings, SettingsInput } from '@sfp/shared'

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

export async function fetchSettings(): Promise<{ settings: UserSettings; tier: string }> {
  const result = await callProxy({ type: 'settings_get' })
  return {
    settings: result.settings as UserSettings,
    tier: result.tier as string,
  }
}

export async function saveSettings(input: SettingsInput): Promise<UserSettings> {
  const result = await callProxy({ type: 'settings_update', settings: input })
  return result.settings as UserSettings
}

export const DEFAULT_SETTINGS_INPUT: SettingsInput = {
  ebayFee:       13,
  pkgCost:       1.25,
  shipCost:      6.00,
  minProfit:     15,
  targetRoi:     200,
  maxDays:       60,
  minStr:        10,
  sourcingStyle: 'balanced',
  shipping:      'buyer',
}

export async function resetToDefaults(): Promise<UserSettings> {
  return saveSettings(DEFAULT_SETTINGS_INPUT)
}
