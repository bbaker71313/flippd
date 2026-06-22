import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, ICONS } from '@sfp/shared'

export interface ScanResultProps {
  decision: 'BUY' | 'HOT' | 'PASS'
  itemName: string
  estimatedProfit: number
  estimatedSell: number
  cost: number
  confidence: number  // 0–100
  roi: number
  reasoning: string
  listingTips?: string[]
  riskFlags?: string[]
  onBuy: () => void
  onPass: () => void
}

// BUY maps to "FLIP" as the display label (you flip the item)
const DECISION_LABEL: Record<ScanResultProps['decision'], string> = {
  BUY:  'FLIP',
  HOT:  'HOT',
  PASS: 'PASS',
}

// Card border, bracket corners, confidence bar, decision badge background
// HOT → COLORS.accent (Scout Gold) per brand spec; BUY → profit green; PASS → loss red
const DECISION_COLOR: Record<ScanResultProps['decision'], string> = {
  BUY:  COLORS.profit,  // #00e676 — display-level green
  HOT:  COLORS.accent,  // #d4a843 — Money Gold (was COLORS.warning)
  PASS: COLORS.loss,    // #ff3333 — display-level red
}

// Decision label badge text color
const DECISION_TEXT_COLOR: Record<ScanResultProps['decision'], string> = {
  BUY:  COLORS.profitText,  // #00e676 — AAA on dark
  HOT:  COLORS.accent,      // #d4a843 — Money Gold at h1 (32px), AAA on dark
  PASS: COLORS.lossText,    // #ff3333 — AA on dark
}

// Scan-bracket corner — 4 absolute-positioned L-shapes marking card corners
function BracketCorner({
  position,
  color,
}: {
  position: 'tl' | 'tr' | 'bl' | 'br'
  color: string
}) {
  const isTop  = position === 'tl' || position === 'tr'
  const isLeft = position === 'tl' || position === 'bl'
  const SIZE   = 22    // arm length in px — slightly longer for presence
  const THICK  = 2.5   // arm thickness — matches logo stroke weight

  return (
    <View
      style={{
        position: 'absolute',
        width:  SIZE,
        height: SIZE,
        top:    isTop  ? SPACING.sm : undefined,   // was 14 — SPACING.sm = 8
        bottom: !isTop ? SPACING.sm : undefined,
        left:   isLeft  ? SPACING.sm : undefined,
        right:  !isLeft ? SPACING.sm : undefined,
      }}
    >
      {/* Horizontal arm */}
      <View
        style={{
          position:        'absolute',
          width:           SIZE,
          height:          THICK,
          backgroundColor: color,
          top:             isTop  ? 0 : undefined,
          bottom:          !isTop ? 0 : undefined,
          left:            0,
          borderRadius:    1,
        }}
      />
      {/* Vertical arm */}
      <View
        style={{
          position:        'absolute',
          width:           THICK,
          height:          SIZE,
          backgroundColor: color,
          top:             0,
          left:            isLeft  ? 0 : undefined,
          right:           !isLeft ? 0 : undefined,
          borderRadius:    1,
        }}
      />
    </View>
  )
}

export function ScanResult({
  decision,
  itemName,
  estimatedProfit,
  estimatedSell,
  cost,
  confidence,
  roi,
  reasoning,
  listingTips,
  riskFlags,
  onBuy,
  onPass,
}: ScanResultProps) {
  const decisionColor = DECISION_COLOR[decision]
  const decisionLabel = DECISION_LABEL[decision]
  const profitIsNeg   = estimatedProfit < 0

  // Mount spring: card snaps in from slightly below + small scale
  const mountScale   = useRef(new Animated.Value(0.94)).current
  const mountOpacity = useRef(new Animated.Value(0)).current
  const mountY       = useRef(new Animated.Value(16)).current

  // BG flash overlay: fades from ~0.18 to ~0.07 on mount
  const flashAnim = useRef(new Animated.Value(0.18)).current

  // Confidence bar fill: 0 → confidence/100 on mount
  const barAnim = useRef(new Animated.Value(0)).current

  // HOT pulse on the decision badge
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Snap-spring mount
    Animated.parallel([
      Animated.spring(mountScale, {
        toValue: 1,
        tension: 320,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.timing(mountOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(mountY, {
        toValue: 0,
        tension: 320,
        friction: 22,
        useNativeDriver: true,
      }),
    ]).start()

    // BG flash settles
    Animated.timing(flashAnim, {
      toValue: 0.07,
      duration: 600,
      useNativeDriver: true,
    }).start()

    // Confidence bar fills
    Animated.timing(barAnim, {
      toValue: confidence / 100,
      duration: 700,
      delay: 250,
      useNativeDriver: false, // width % cannot use native driver
    }).start()

    // HOT pulse loop
    let pulse: Animated.CompositeAnimation | null = null
    if (decision === 'HOT') {
      pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 550, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 550, useNativeDriver: true }),
        ])
      )
      pulse.start()
    }

    return () => { pulse?.stop() }
  }, [decision, confidence])

  const formatCurrency = (n: number) =>
    `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`

  const formatROI = (n: number) =>
    `${n >= 0 ? '+' : ''}${n.toFixed(0)}%`

  // Label letter spacing — brand guide: type.label +0.06em
  const labelLetterSpacing = TYPOGRAPHY.label.fontSize * 0.06

  return (
    <Animated.View
      style={{
        transform: [
          { scale: mountScale },
          { translateY: mountY },
        ],
        opacity: mountOpacity,
      }}
    >
      <View
        style={{
          backgroundColor: COLORS.elevated,
          borderRadius:    RADIUS.lg,
          borderWidth:     1.5,
          borderColor:     decisionColor,
          overflow:        'hidden',
          padding:         SPACING.xl,
        }}
      >
        {/* Tinted flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={{
            position:        'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: decisionColor,
            opacity:         flashAnim,
          }}
        />

        {/* Scan bracket corners */}
        <BracketCorner position="tl" color={decisionColor} />
        <BracketCorner position="tr" color={decisionColor} />
        <BracketCorner position="bl" color={decisionColor} />
        <BracketCorner position="br" color={decisionColor} />

        {/* ── DECISION LABEL ── */}
        <Animated.View
          className="items-center"
          style={{
            transform: [{ scale: decision === 'HOT' ? pulseAnim : 1 }],
            marginBottom: SPACING.sm,
          }}
        >
          <Text
            style={{
              fontFamily:    TYPOGRAPHY.h1.fontFamily,
              fontSize:      TYPOGRAPHY.h1.fontSize,
              fontWeight:    TYPOGRAPHY.h1.fontWeight,
              letterSpacing: 6,           // wide tracking — instrument panel readout feel
              color:         DECISION_TEXT_COLOR[decision],
            }}
          >
            {decisionLabel}
          </Text>
        </Animated.View>

        {/* ── ITEM NAME ── */}
        <Text
          numberOfLines={2}
          className="text-center mb-2"
          style={{
            fontFamily: TYPOGRAPHY.body.fontFamily,
            fontSize:   TYPOGRAPHY.body.fontSize,
            fontWeight: TYPOGRAPHY.body.fontWeight,
            color:      COLORS.textSecondary,
          }}
        >
          {itemName}
        </Text>

        {/* ── PROFIT NUMBER — hero element, largest text on card ── */}
        {/* Brand guide: type.display always uses profit/loss display color (not .text variant) */}
        {/* Brand guide: type.display letter-spacing = -0.02em */}
        <Text
          className="text-center"
          style={{
            fontFamily:    TYPOGRAPHY.display.fontFamily,
            fontSize:      TYPOGRAPHY.display.fontSize,
            fontWeight:    TYPOGRAPHY.display.fontWeight,
            lineHeight:    TYPOGRAPHY.display.lineHeight,
            letterSpacing: TYPOGRAPHY.display.fontSize * -0.02,  // -0.02em = -0.96 ≈ -1
            color:         profitIsNeg ? COLORS.loss : COLORS.profit,
            marginBottom:  SPACING.lg,
          }}
        >
          {formatCurrency(estimatedProfit)}
        </Text>

        {/* ── DATA ROW: sell / cost / ROI ── */}
        {/* COLORS.background (warm parchment) creates depth against the elevated (white) card */}
        <View
          className="flex-row justify-between"
          style={{
            backgroundColor: COLORS.background,
            borderRadius:    RADIUS.sm,
            padding:         SPACING.md,
            marginBottom:    SPACING.lg,
          }}
        >
          <View className="items-center">
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, letterSpacing: labelLetterSpacing }}>
              SELL
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: TYPOGRAPHY.mono.fontWeight, color: COLORS.textPrimary }}>
              ${estimatedSell.toFixed(2)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: COLORS.border }} />
          <View className="items-center">
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, letterSpacing: labelLetterSpacing }}>
              COST
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: TYPOGRAPHY.mono.fontWeight, color: COLORS.textPrimary }}>
              ${cost.toFixed(2)}
            </Text>
          </View>
          <View style={{ width: 1, backgroundColor: COLORS.border }} />
          <View className="items-center">
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, letterSpacing: labelLetterSpacing }}>
              ROI
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: TYPOGRAPHY.mono.fontWeight, color: roi >= 0 ? COLORS.profitText : COLORS.lossText }}>
              {formatROI(roi)}
            </Text>
          </View>
        </View>

        {/* ── CONFIDENCE BAR ── */}
        <View style={{ marginBottom: SPACING.lg }}>
          <View className="flex-row justify-between mb-1">
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, letterSpacing: labelLetterSpacing }}>
              CONFIDENCE
            </Text>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, letterSpacing: labelLetterSpacing }}>
              {confidence}%
            </Text>
          </View>
          <View
            style={{
              height:          6,
              backgroundColor: COLORS.border,
              borderRadius:    RADIUS.full,
              overflow:        'hidden',
            }}
          >
            <Animated.View
              style={{
                height:          6,
                backgroundColor: decisionColor,
                borderRadius:    RADIUS.full,
                width: barAnim.interpolate({
                  inputRange:  [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              }}
            />
          </View>
        </View>

        {/* ── REASONING ── */}
        <Text
          numberOfLines={3}
          style={{
            fontFamily:   TYPOGRAPHY.caption.fontFamily,
            fontSize:     TYPOGRAPHY.caption.fontSize,
            color:        COLORS.textMuted,
            marginBottom: SPACING.xl,
            lineHeight:   TYPOGRAPHY.caption.lineHeight,
          }}
        >
          {reasoning}
        </Text>

        {/* ── LISTING TIPS — was: missing; now: populated from AI response */}
        {listingTips && listingTips.length > 0 && (
          <View style={{ marginBottom: SPACING.lg }}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, letterSpacing: labelLetterSpacing, marginBottom: SPACING.xs }}>
              LISTING TIPS
            </Text>
            {listingTips.map((tip, i) => (
              <Text key={i} style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textSecondary, marginBottom: 4 }}>
                · {tip}
              </Text>
            ))}
          </View>
        )}

        {/* ── CHECK THIS (risk flags) — was: missing; now: populated from AI response */}
        {riskFlags && riskFlags.length > 0 && (
          <View style={{ marginBottom: SPACING.lg, backgroundColor: COLORS.loss + '18', borderRadius: RADIUS.sm, padding: SPACING.sm }}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.lossText, letterSpacing: labelLetterSpacing, marginBottom: SPACING.xs }}>
              CHECK THIS
            </Text>
            {riskFlags.map((flag, i) => (
              <Text key={i} style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.lossText, marginBottom: 4 }}>
                · {flag}
              </Text>
            ))}
          </View>
        )}

        {/* ── ACTION BUTTONS ── */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={onPass}
            className="flex-1 items-center justify-center"
            style={({ pressed }: { pressed: boolean }) => ({
              height:          SPACING.xxl,
              borderRadius:    RADIUS.md,
              borderWidth:     1.5,
              borderColor:     COLORS.borderStrong,
              backgroundColor: pressed ? COLORS.surface : COLORS.elevated,
            })}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.body.fontFamily,
                fontSize:   TYPOGRAPHY.body.fontSize,
                fontWeight: '600',
                color:      COLORS.textSecondary,
              }}
            >
              Pass
            </Text>
          </Pressable>

          <Pressable
            onPress={onBuy}
            className="flex-1 items-center justify-center"
            style={({ pressed }: { pressed: boolean }) => ({
              height:          SPACING.xxl,
              borderRadius:    RADIUS.md,
              backgroundColor: pressed
                ? COLORS.brandDim
                : decision === 'PASS' ? COLORS.neutral : decisionColor,
            })}
          >
            <Text
              style={{
                fontFamily: TYPOGRAPHY.body.fontFamily,
                fontSize:   TYPOGRAPHY.body.fontSize,
                fontWeight: '700',
                color:      COLORS.elevated,   // was '#ffffff'
              }}
            >
              {decisionLabel === 'PASS' ? 'Buy Anyway' : 'Buy It'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}
