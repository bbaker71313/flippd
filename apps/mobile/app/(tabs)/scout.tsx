import { useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput,
  ActivityIndicator, ScrollView, Alert, Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
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

function ShelfItemRow({ item, onBuy }: { item: ShelfItem; onBuy: (item: ShelfItem) => void }) {
  const color = DECISION_COLOR[item.decision];
  const label = DECISION_LABEL[item.decision];
  return (
    <View className="flex-row items-center bg-white rounded-xl mx-4 mb-3 p-4 border border-stone-200">
      <View className="w-14 h-14 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: color + '20' }}>
        <Text className="font-bold text-base" style={{ color }}>{label}</Text>
      </View>
      <View className="flex-1 mr-2">
        <Text className="text-stone-900 font-semibold text-sm" numberOfLines={2}>{item.itemName as string}</Text>
        <Text className="text-stone-500 text-xs mt-0.5">{item.decisionReason as string}</Text>
      </View>
      <View className="items-end">
        <Text className="font-bold text-base" style={{ color: item.estimatedProfit >= 0 ? '#00e676' : '#ff3333' }}>
          {item.estimatedProfit >= 0 ? '+' : ''}${Math.abs(item.estimatedProfit).toFixed(0)}
        </Text>
        <Text className="text-stone-400 text-xs">{item.roi.toFixed(0)}% ROI</Text>
        {item.decision !== 'PASS' && (
          <TouchableOpacity
            className="mt-1 bg-emerald-500 rounded-lg px-3 py-1"
            onPress={() => onBuy(item)}
          >
            <Text className="text-white font-semibold text-xs">Buy It</Text>
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
      <SafeAreaView className="flex-1 bg-stone-950 items-center justify-center px-8">
        <Text className="text-white text-2xl font-bold text-center mb-3">Camera Access Needed</Text>
        <Text className="text-stone-400 text-base text-center mb-8">
          ScanForProfit needs your camera to scan items. Your photos are never stored on our servers.
        </Text>
        <TouchableOpacity
          className="bg-emerald-500 rounded-xl px-8 py-4"
          onPress={requestPermission}
        >
          <Text className="text-white font-bold text-base">Allow Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-black">
      {/* Camera — always mounted, stays behind overlays */}
      <CameraView ref={cameraRef} facing="back" style={{ flex: 1 }} />

      {/* Top bar */}
      <SafeAreaView className="absolute top-0 left-0 right-0" edges={['top']} pointerEvents="box-none">
        <View className="mx-4 mt-2">
          <Text className="text-white text-center font-bold text-xs tracking-widest mb-3 opacity-80">
            SCAN FOR PROFIT
          </Text>
          {/* Mode toggle */}
          <View className="flex-row bg-black/50 rounded-xl p-1 self-center">
            {(['single', 'shelf'] as ScanMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                className={`px-5 py-2 rounded-lg ${mode === m ? 'bg-emerald-500' : ''}`}
                onPress={() => { if (status === 'idle') setMode(m); }}
              >
                <Text className={`text-xs font-semibold tracking-wider ${mode === m ? 'text-white' : 'text-stone-400'}`}>
                  {m === 'single' ? 'SINGLE ITEM' : 'SHELF SCAN'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom capture button */}
      {status === 'idle' && (
        <View className="absolute bottom-0 left-0 right-0 pb-12 items-center" pointerEvents="box-none">
          <TouchableOpacity
            onPress={handleCapture}
            className="w-20 h-20 rounded-full bg-white items-center justify-center"
            style={{ shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}
          >
            <View className="w-16 h-16 rounded-full border-4 border-stone-800 bg-white" />
          </TouchableOpacity>
        </View>
      )}

      {/* Analyzing overlay */}
      {status === 'analyzing' && (
        <View className="absolute inset-0 bg-black/70 items-center justify-center">
          <ActivityIndicator size="large" color="#00e676" />
          <Text className="text-white font-semibold text-base mt-4">Analyzing...</Text>
          <Text className="text-stone-400 text-sm mt-1">
            {mode === 'single' ? 'Identifying item and pulling sold comps' : 'Scanning shelf for flip opportunities'}
          </Text>
        </View>
      )}

      {/* Error overlay */}
      {status === 'error' && errorMsg && (
        <View className="absolute bottom-0 left-0 right-0 pb-12 px-4">
          <View className="bg-red-950 border border-red-700 rounded-xl p-4 mb-4">
            <Text className="text-red-400 font-semibold mb-1">Scan failed</Text>
            <Text className="text-red-300 text-sm">{errorMsg}</Text>
          </View>
          <TouchableOpacity className="bg-stone-800 rounded-xl py-4 items-center" onPress={reset}>
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Single result card */}
      {status === 'result_single' && singleResult && (
        <View className="absolute bottom-0 left-0 right-0 px-4 pb-8">
          <ScanResult
            decision={singleResult.decision}
            itemName={singleResult.itemName as string}
            estimatedProfit={singleResult.estimatedProfit}
            estimatedSell={singleResult.estimatedSell}
            cost={singleResult.estimatedCost}
            confidence={singleResult.confidence}
            roi={singleResult.roi}
            reasoning={singleResult.reasoning as string}
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
        <View className="absolute bottom-0 left-0 right-0" style={{ maxHeight: '70%' }}>
          <View className="bg-stone-950/95 rounded-t-2xl pt-4 flex-1">
            <View className="flex-row items-center justify-between px-4 mb-3">
              <Text className="text-white font-bold text-base">
                {shelfResults.length} {shelfResults.length === 1 ? 'item' : 'items'} found
              </Text>
              <TouchableOpacity onPress={reset}>
                <Text className="text-stone-400 text-sm">Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {shelfResults.length === 0 ? (
                <View className="items-center py-12 px-8">
                  <Text className="text-stone-400 text-center">No items identified. Try better lighting or a closer shot.</Text>
                </View>
              ) : (
                shelfResults.map((item, i) => (
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
              <View className="h-8" />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Buy modal */}
      <Modal visible={buyVisible} transparent animationType="slide" onRequestClose={() => setBuyVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-stone-950 rounded-t-2xl px-6 pt-6 pb-10">
            <Text className="text-white font-bold text-lg mb-1">What did you pay?</Text>
            <Text className="text-stone-400 text-sm mb-6" numberOfLines={1}>{pendingBuy?.itemName}</Text>

            <Text className="text-stone-300 text-xs font-medium mb-2 uppercase tracking-wider">Your Cost</Text>
            <TextInput
              className="bg-stone-800 text-white rounded-xl px-4 py-4 text-2xl font-bold mb-6"
              placeholder="0.00"
              placeholderTextColor="#64748b"
              keyboardType="decimal-pad"
              value={buyCost}
              onChangeText={setBuyCost}
              autoFocus
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-stone-800 rounded-xl py-4 items-center"
                onPress={() => setBuyVisible(false)}
              >
                <Text className="text-stone-300 font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-emerald-500 rounded-xl py-4 items-center"
                onPress={handleConfirmBuy}
                disabled={buyLoading}
              >
                {buyLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text className="text-white font-bold">Add to Inventory</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
