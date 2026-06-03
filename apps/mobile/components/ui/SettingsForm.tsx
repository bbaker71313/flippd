import React, { useState, useEffect } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared'
import type { SettingsInput, SourcingStyle } from '@sfp/shared'

export interface SettingsFormProps {
  initialValues: SettingsInput
  onSave: (input: SettingsInput) => void
  onCancel: () => void
  onReset: () => void
  saving: boolean
}

type StringDraft = {
  ebayFee: string; pkgCost: string; shipCost: string; minProfit: string;
  targetRoi: string; maxDays: string; minStr: string;
  sourcingStyle: SourcingStyle; shipping: string;
}

type FieldErrors = Partial<Record<keyof SettingsInput, string>>

const SOURCING_OPTIONS: { label: string; value: SourcingStyle }[] = [
  { label: 'Conservative', value: 'conservative' },
  { label: 'Balanced',     value: 'balanced' },
  { label: 'Aggressive',   value: 'aggressive' },
]

const SHIPPING_OPTIONS: { label: string; value: string }[] = [
  { label: 'Buyer pays', value: 'buyer' },
  { label: 'Seller pays', value: 'seller' },
]

function GroupHeader({ title }: { title: string }) {
  return (
    <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, fontWeight: '600', color: COLORS.textMuted, marginTop: SPACING.lg, marginBottom: SPACING.sm }}>
      {title.toUpperCase()}
    </Text>
  )
}

function NumericField({
  label, value, onChange, error, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  error?: string; placeholder?: string
}) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? '0'}
        placeholderTextColor={COLORS.textMuted}
        keyboardType="decimal-pad"
        style={{
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.sm,
          borderWidth: 1,
          borderColor: error ? COLORS.lossText : COLORS.border,
          paddingHorizontal: SPACING.md,
          paddingVertical: SPACING.sm,
          fontFamily: TYPOGRAPHY.body.fontFamily,
          fontSize: TYPOGRAPHY.body.fontSize,
          color: COLORS.textPrimary,
        }}
      />
      {!!error && (
        <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.lossText, marginTop: 2 }}>
          {error}
        </Text>
      )}
    </View>
  )
}

function PickerRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T; options: { label: string; value: T }[]; onChange: (v: T) => void
}) {
  return (
    <View style={{ marginBottom: SPACING.md }}>
      <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs }}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              paddingHorizontal: SPACING.md,
              paddingVertical: 6,
              borderRadius: RADIUS.full,
              backgroundColor: value === opt.value ? COLORS.brand : COLORS.surface,
              borderWidth: 1,
              borderColor: value === opt.value ? COLORS.brand : COLORS.border,
            }}
          >
            <Text style={{
              fontFamily: TYPOGRAPHY.label.fontFamily,
              fontSize: TYPOGRAPHY.label.fontSize,
              color: value === opt.value ? COLORS.elevated : COLORS.textMuted,
            }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

function toStringDraft(v: SettingsInput): StringDraft {
  return {
    ebayFee:       String(v.ebayFee),
    pkgCost:       String(v.pkgCost),
    shipCost:      String(v.shipCost),
    minProfit:     String(v.minProfit),
    targetRoi:     String(v.targetRoi),
    maxDays:       String(v.maxDays),
    minStr:        String(v.minStr),
    sourcingStyle: v.sourcingStyle,
    shipping:      v.shipping,
  }
}

function validateDraft(d: StringDraft): FieldErrors {
  const errs: FieldErrors = {}
  const fee = parseFloat(d.ebayFee)
  if (isNaN(fee) || fee < 0 || fee > 50)                 errs.ebayFee   = 'Must be 0–50'
  if (isNaN(parseFloat(d.pkgCost)) || parseFloat(d.pkgCost) < 0)    errs.pkgCost   = 'Must be ≥ 0'
  if (isNaN(parseFloat(d.shipCost)) || parseFloat(d.shipCost) < 0)  errs.shipCost  = 'Must be ≥ 0'
  if (isNaN(parseFloat(d.minProfit)) || parseFloat(d.minProfit) < 0) errs.minProfit = 'Must be ≥ 0'
  const roi = parseFloat(d.targetRoi)
  if (isNaN(roi) || roi < 0 || roi > 1000)               errs.targetRoi = 'Must be 0–1000'
  const days = parseInt(d.maxDays, 10)
  if (isNaN(days) || days < 1 || days > 999)             errs.maxDays   = 'Must be 1–999'
  const minStr = parseInt(d.minStr, 10)
  if (isNaN(minStr) || minStr < 1 || minStr > 100)       errs.minStr    = 'Must be 1–100'
  return errs
}

function draftToInput(d: StringDraft): SettingsInput {
  return {
    ebayFee:       parseFloat(d.ebayFee),
    pkgCost:       parseFloat(d.pkgCost),
    shipCost:      parseFloat(d.shipCost),
    minProfit:     parseFloat(d.minProfit),
    targetRoi:     parseFloat(d.targetRoi),
    maxDays:       parseInt(d.maxDays, 10),
    minStr:        parseInt(d.minStr, 10),
    sourcingStyle: d.sourcingStyle,
    shipping:      d.shipping,
  }
}

export function SettingsForm({ initialValues, onSave, onCancel, onReset, saving }: SettingsFormProps) {
  const [draft, setDraft] = useState<StringDraft>(() => toStringDraft(initialValues))
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    setDraft(toStringDraft(initialValues))
    setErrors({})
  }, [initialValues])

  function set(field: keyof StringDraft, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    const errs = validateDraft(draft)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    onSave(draftToInput(draft))
  }

  function handleCancel() {
    setDraft(toStringDraft(initialValues))
    setErrors({})
    onCancel()
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Reset */}
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.sm }}>
        <TouchableOpacity onPress={onReset} disabled={saving}
          style={{ paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: COLORS.border }}>
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted }}>
            Reset to Defaults
          </Text>
        </TouchableOpacity>
      </View>

      <GroupHeader title="Pricing" />
      <NumericField label="eBay Fee % (0–50)"         value={draft.ebayFee}   onChange={v => set('ebayFee', v)}   error={errors.ebayFee}   placeholder="13" />
      <NumericField label="Pkg Cost $"                 value={draft.pkgCost}   onChange={v => set('pkgCost', v)}   error={errors.pkgCost}   placeholder="1.25" />
      <NumericField label="Ship Cost $"                value={draft.shipCost}  onChange={v => set('shipCost', v)}  error={errors.shipCost}  placeholder="6.00" />
      <NumericField label="Min Profit $"               value={draft.minProfit} onChange={v => set('minProfit', v)} error={errors.minProfit} placeholder="15" />

      <GroupHeader title="Inventory Rules" />
      <NumericField label="Target ROI % (0–1000)"      value={draft.targetRoi} onChange={v => set('targetRoi', v)} error={errors.targetRoi} placeholder="200" />
      <NumericField label="Max Days in Inventory (1–999)" value={draft.maxDays} onChange={v => set('maxDays', v)} error={errors.maxDays}  placeholder="60" />
      <NumericField label="Min Title Length (1–100)"   value={draft.minStr}    onChange={v => set('minStr', v)}    error={errors.minStr}    placeholder="10" />

      <GroupHeader title="Preferences" />
      <PickerRow<SourcingStyle>
        label="Sourcing Style"
        value={draft.sourcingStyle}
        options={SOURCING_OPTIONS}
        onChange={v => setDraft(prev => ({ ...prev, sourcingStyle: v }))}
      />
      <PickerRow<string>
        label="Shipping — who pays?"
        value={draft.shipping}
        options={SHIPPING_OPTIONS}
        onChange={v => setDraft(prev => ({ ...prev, shipping: v }))}
      />

      <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl }}>
        <TouchableOpacity onPress={handleCancel} disabled={saving}
          style={{ flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border }}>
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving}
          style={{ flex: 1, paddingVertical: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.brand, alignItems: 'center' }}>
          {saving
            ? <ActivityIndicator color={COLORS.elevated} />
            : <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.elevated }}>SAVE</Text>
          }
        </TouchableOpacity>
      </View>

      <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.md }}>
        Settings sync to all devices
      </Text>
    </ScrollView>
  )
}
