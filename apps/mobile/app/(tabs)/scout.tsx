import { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, ScrollView, Alert, Pressable, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@sfp/shared';
import { ScanResult } from '../../components/ui/ScanResult';
import { takePicture } from '../../lib/camera';
import { supabase } from '../../lib/supabase';

type ScanMode = 'single' | 'shelf';
type Status = 'idle' | 'analyzing' | 'result_single' | 'result_shelf' | 'error';

interface SingleResult {
  decision: 'BUY' | 'HOT' | 'PASS';
  itemName: string;
  estimatedProfit: number;
  estimatedSell: number;
  estimatedCost: number;
  confidence: number;
  roi: number;
  reasoning: string;
  category: string;
  searchKeywords: string[];
  listingTips: string[];
  riskFlags: string[];
  scanLogId: number | null;
}

interface ShelfItem {
  decision: 'BUY' | 'HOT' | 'PASS';
  itemName: string;
  estimatedProfit: number;
  avgSoldPrice: number;
  estimatedCost: number;
  roi: number;
  confidence: number;
  decisionReason: string;
  category: string;
}

const DECISION_COLOR: Record<'BUY' | 'HOT' | 'PASS', string> = {
  BUY: '#00e676', HOT: '#f5a623', PASS: '#8a8070',
};
const DECISION_LABEL: Record<'BUY' | 'HOT' | 'PASS', string> = {
  BUY: 'FLIP', HOT: 'HOT', PASS: 'PASS',
};

function ShelfItemRow({ item, onBuy }: { item: ShelfItem; onBuy: () => void }) {
  const color = DECISION_COLOR[item.decision];
  const label = DECISION_LABEL[item.decision];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, marginHorizontal: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border }}>
      <View style={{ width: 56, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm, backgroundColor: color + '20' }}>
        <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '700', fontSize: TYPOGRAPHY.label.fontSize, color }}>{label}</Text>
      </View>
      <View style={{ flex: 1, marginRight: SPACING.sm }}>
        <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, fontWeight: '600', color: COLORS.textPrimary }} numberOfLines={2}>{item.itemName as string}</Text>
        <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: 2 }}>{item.decisionReason as string}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: TYPOGRAPHY.mono.fontFamily, fontSize: TYPOGRAPHY.mono.fontSize, fontWeight: '700', color: item.estimatedProfit >= 0 ? COLORS.profit : COLORS.loss }}>
          {item.estimatedProfit >= 0 ? '+' : ''}${Math.abs(item.estimatedProfit).toFixed(0)}
        </Text>
        <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>{item.roi.toFixed(0)}% ROI</Text>
        {item.decision !== 'PASS' && (
          <TouchableOpacity
            style={{ marginTop: 4, backgroundColor: COLORS.accent, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 }}
            onPress={() => onBuy()}
          >
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.inverse }}>Buy It</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function ScoutScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('single');
  const [status, setStatus] = useState<Status>('idle');
  const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
  const [shelfResults, setShelfResults] = useState<ShelfItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Change 2: Animated logo pulse — 2s loop, opacity 0.7→1.0→0.7, brand green
  const logoOpacity = useRef(new Animated.Value(0.7)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(logoOpacity, { toValue: 1.0, duration: 1000, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Buy modal state
  const [buyVisible, setBuyVisible] = useState(false);
  const [buyCost, setBuyCost] = useState('');
  const [buyLoading, setBuyLoading] = useState(false);
  const [pendingBuy, setPendingBuy] = useState<{ itemName: string; category: string; sellPrice: number; scanLogId: number | null; sourcingMeta: unknown } | null>(null);

  const reset = useCallback(() => {
    setSingleResult(null);
    setShelfResults([]);
    setErrorMsg(null);
    setStatus('idle');
  }, []);

  const getProxyUrl = () => `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claude-proxy`;

  async function callProxy(body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Session expired. Please sign in again.');

    const res = await fetch(getProxyUrl(), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const data = await res.json();
      if (data.error === 'scan_limit_reached') {
        throw new Error(`LIMIT_REACHED:You've used all ${data.limit} free scans this month.`);
      }
      throw new Error('Too many requests. Try again shortly.');
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `Server error (${res.status})`);
    }

    return res.json();
  }

  async function handleCapture() {
    if (status !== 'idle') return;
    setStatus('analyzing');
    setErrorMsg(null);

    let imageBase64: string;
    try {
      imageBase64 = await takePicture(cameraRef);
    } catch {
      setErrorMsg('Could not capture photo. Try again.');
      setStatus('error');
      return;
    }

    try {
      if (mode === 'single') {
        const result = await callProxy({ type: 'single_scan', imageBase64 }) as unknown as SingleResult;
        setSingleResult(result);
        setStatus('result_single');
      } else {
        const result = await callProxy({ type: 'shelf_scan', imageBase64 }) as { items: ShelfItem[] };
        setShelfResults(result.items ?? []);
        setStatus('result_shelf');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Scan failed. Try again.';
      if (msg.startsWith('LIMIT_REACHED:')) {
        Alert.alert('Scan Limit Reached', msg.slice(14) + '\n\nUpgrade to Hustle for unlimited scans.', [
          { text: 'Not now', style: 'cancel', onPress: reset },
          { text: 'Upgrade', onPress: reset },
        ]);
      } else {
        setErrorMsg(msg);
      }
      setStatus('error');
    }
  }

  function openBuyModal(item: { itemName: string; category: string; avgSoldPrice?: number; estimatedSell?: number; scanLogId?: number | null; sourcingMeta?: unknown }) {
    setPendingBuy({
      itemName: item.itemName,
      category: item.category as string,
      sellPrice: (item.avgSoldPrice ?? item.estimatedSell) as number ?? 0,
      scanLogId: item.scanLogId ?? null,
      sourcingMeta: null,
    });
    setBuyCost('');
    setBuyVisible(true);
  }

  async function handleConfirmBuy() {
    if (!pendingBuy) return;
    const cost = parseFloat(buyCost);
    if (isNaN(cost) || cost < 0) {
      Alert.alert('Enter your cost', 'How much did you pay for this item?');
      return;
    }
    setBuyLoading(true);
    try {
      await callProxy({
        type: 'buy_item',
        itemName: pendingBuy.itemName,
        category: pendingBuy.category,
        cost,
        sellPrice: pendingBuy.sellPrice,
        scanLogId: pendingBuy.scanLogId,
        sourcingMeta: pendingBuy.sourcingMeta,
      });
      setBuyVisible(false);
      Alert.alert('Added to Inventory', `${pendingBuy.itemName} saved. Cost: $${cost.toFixed(2)}`);
      reset();
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save item.');
    } finally {
      setBuyLoading(false);
    }
  }

  // ── Permission denied ──────────────────────────────────────────────────────
  if (!permission) return <View className="flex-1 bg-stone-950" />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl }}>
        <Text style={{ fontFamily: TYPOGRAPHY.h2.fontFamily, fontSize: TYPOGRAPHY.h2.fontSize, fontWeight: TYPOGRAPHY.h2.fontWeight, color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.sm }}>
          Camera Access Needed
        </Text>
        <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted, textAlign: 'center', marginBottom: SPACING.xl }}>
          ScanForProfit needs your camera to scan items. Your photos are never stored on our servers.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.profit, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md }}
          onPress={requestPermission}
        >
          <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '700', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.inverse }}>ALLOW CAMERA</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.inverse }}>
      {/* Camera — always mounted, stays behind overlays */}
      <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />

      {/* Top bar */}
      <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }} edges={['top']} pointerEvents="box-none">
        <View style={{ marginHorizontal: SPACING.md, marginTop: SPACING.sm }}>
          {/* Change 2: Animated logo placeholder — pulse animation shell
              TODO: replace with actual logo asset — LOGO_ASSET_PATH */}
          <Animated.View style={{ opacity: logoOpacity, alignItems: 'center', marginBottom: SPACING.sm }}>
            {/* Fallback: "SFP" in Syne 800 brand green until logo asset is provided */}
            <Text style={{ fontFamily: TYPOGRAPHY.display.fontFamily, fontSize: 18, fontWeight: '800', color: COLORS.profit, letterSpacing: 4 }}>
              SFP
            </Text>
          </Animated.View>
          {/* Mode toggle */}
          <View style={{ flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: RADIUS.lg, padding: 4, alignSelf: 'center' }}>
            {(['single', 'shelf'] as ScanMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={{ paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: mode === m ? COLORS.accent : 'transparent' }}
                onPress={() => { if (status === 'idle') setMode(m); }}
              >
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: mode === m ? COLORS.inverse : COLORS.textMuted }}>
                  {m === 'single' ? 'SINGLE ITEM' : 'SHELF SCAN'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom capture button */}
      {status === 'idle' && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 48, alignItems: 'center' }} pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleCapture}
            style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.textPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
          >
            <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: COLORS.background, backgroundColor: COLORS.textPrimary }} />
          </TouchableOpacity>
        </View>
      )}

      {/* Analyzing overlay */}
      {status === 'analyzing' && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.profit} />
          <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary, marginTop: SPACING.md }}>Analyzing...</Text>
          <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginTop: SPACING.xs }}>
            {mode === 'single' ? 'Identifying item and pulling sold comps' : 'Scanning shelf for flip opportunities'}
          </Text>
        </View>
      )}

      {/* Error overlay */}
      {status === 'error' && errorMsg && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: 48, paddingHorizontal: SPACING.md }}>
          <View style={{ backgroundColor: COLORS.loss + '18', borderWidth: 1, borderColor: COLORS.loss, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md }}>
            <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.lossText, marginBottom: 4 }}>Scan failed</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.lossText }}>{errorMsg}</Text>
          </View>
          <TouchableOpacity style={{ backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, alignItems: 'center' }} onPress={reset}>
            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textPrimary }}>TRY AGAIN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Single result card */}
      {status === 'result_single' && singleResult && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: SPACING.md, paddingBottom: SPACING.xl }}>
          <ScanResult
            decision={singleResult.decision}
            itemName={singleResult.itemName as string}
            estimatedProfit={singleResult.estimatedProfit}
            estimatedSell={singleResult.estimatedSell}
            cost={singleResult.estimatedCost}
            confidence={singleResult.confidence}
            roi={singleResult.roi}
            reasoning={singleResult.reasoning as string}
            listingTips={singleResult.listingTips}
            riskFlags={singleResult.riskFlags}
            onBuy={() => openBuyModal({
              itemName: singleResult.itemName as string,
              category: singleResult.category as string,
              estimatedSell: singleResult.estimatedSell,
              scanLogId: singleResult.scanLogId,
            })}
            onPass={reset}
          />
        </View>
      )}

      {/* Shelf results */}
      {status === 'result_shelf' && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '70%' }}>
          <View style={{ backgroundColor: COLORS.background + 'f5', borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingTop: SPACING.md, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, marginBottom: SPACING.sm }}>
              <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontWeight: '700', fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textPrimary }}>
                {shelfResults.length} {shelfResults.length === 1 ? 'item' : 'items'} found
              </Text>
              <TouchableOpacity onPress={reset}>
                <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted }}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
              {shelfResults.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: SPACING.xl }}>
                  <Text style={{ fontFamily: TYPOGRAPHY.body.fontFamily, fontSize: TYPOGRAPHY.body.fontSize, color: COLORS.textMuted, textAlign: 'center' }}>No items identified. Try better lighting or a closer shot.</Text>
                </View>
              ) : (
                shelfResults.map((item: ShelfItem, i: number) => (
                  <ShelfItemRow
                    key={i}
                    item={item}
                    onBuy={() => openBuyModal({
                      itemName: item.itemName as string,
                      category: item.category as string,
                      avgSoldPrice: item.avgSoldPrice,
                      scanLogId: null,
                    })}
                  />
                ))
              )}
              <View style={{ height: SPACING.xl }} />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Buy modal */}
      <Modal visible={buyVisible} transparent animationType="slide" onRequestClose={() => setBuyVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.inverse + '99' }}>
          <View style={{ backgroundColor: COLORS.elevated, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: 40 }}>
            <Text style={{ fontFamily: TYPOGRAPHY.h3.fontFamily, fontSize: TYPOGRAPHY.h3.fontSize, fontWeight: TYPOGRAPHY.h3.fontWeight, color: COLORS.textPrimary, marginBottom: 4 }}>What did you pay?</Text>
            <Text style={{ fontFamily: TYPOGRAPHY.caption.fontFamily, fontSize: TYPOGRAPHY.caption.fontSize, color: COLORS.textMuted, marginBottom: SPACING.xl }} numberOfLines={1}>{pendingBuy?.itemName}</Text>

            <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textMuted, marginBottom: 6 }}>YOUR COST</Text>
            <TextInput
              style={{ backgroundColor: COLORS.surface, color: COLORS.textPrimary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, fontSize: 28, fontWeight: '700', marginBottom: SPACING.xl, borderWidth: 1, borderColor: COLORS.border }}
              placeholder="0.00"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="decimal-pad"
              value={buyCost}
              onChangeText={setBuyCost}
              autoFocus
            />

            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' }}
                onPress={() => setBuyVisible(false)}
              >
                <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '600', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.textSecondary }}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: COLORS.profit, borderRadius: RADIUS.md, paddingVertical: SPACING.md, alignItems: 'center' }}
                onPress={handleConfirmBuy}
                disabled={buyLoading}
              >
                {buyLoading
                  ? <ActivityIndicator color={COLORS.inverse} />
                  : <Text style={{ fontFamily: TYPOGRAPHY.label.fontFamily, fontWeight: '700', fontSize: TYPOGRAPHY.label.fontSize, color: COLORS.inverse }}>ADD TO INVENTORY</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
