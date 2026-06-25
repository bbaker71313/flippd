/**
 * Sourcing decision engine.
 * Ported verbatim from Flippd business logic — do not change thresholds.
 * Pure function — settings injected, no globals.
 */

/** @typedef {'HOT'|'LIST'|'SKIP'} ScanDecision */
/** @typedef {'conservative'|'balanced'|'aggressive'} SourcingStyle */

const STYLE_MULTIPLIER = {
  conservative: 1.3,
  balanced: 1.0,
  aggressive: 0.75,
};

/**
 * @typedef {Object} DecisionSettings
 * @property {SourcingStyle} style
 * @property {number} minProfit
 * @property {number} maxDays
 * @property {number} minStr     - minimum sell-through rate
 * @property {number} targetRoi
 */

/**
 * @typedef {Object} DecisionInput
 * @property {number} profit
 * @property {number} roi
 * @property {number} days        - avg days to sell
 * @property {number} sellThrough - 0–100
 * @property {'LOW'|'MEDIUM'|'HIGH'|'VERY HIGH'} demandLevel
 * @property {number} confidence  - 0–100
 */

/**
 * Compute a BUY/HOT/SKIP decision from AI scan data + user settings.
 * @param {DecisionInput} input
 * @param {DecisionSettings} settings
 * @returns {ScanDecision}
 */
export function getDecision(input, settings) {
  const { profit, roi, days, sellThrough, demandLevel, confidence } = input;
  const { style, minProfit, maxDays, minStr, targetRoi } = settings;

  const sb = STYLE_MULTIPLIER[style] ?? 1.0;
  const adjMinProfit = minProfit * sb;
  const adjMaxDays   = maxDays   / sb;
  const adjMinStr    = minStr    * sb;
  const conf = confidence ?? 100;

  if (profit < adjMinProfit || days > adjMaxDays || sellThrough < adjMinStr || conf < 50) {
    return 'SKIP';
  }

  const isHot = (demandLevel === 'HIGH' || demandLevel === 'VERY HIGH')
    || profit >= adjMinProfit * 2
    || roi    >= targetRoi    * 2;

  if (isHot && conf >= 70) return 'HOT';
  return 'LIST';
}

/**
 * CSS class for a scan decision badge.
 * @param {ScanDecision} decision
 * @returns {string}
 */
export function decisionClass(decision) {
  return { HOT: 'badge-hot', LIST: 'badge-buy', SKIP: 'badge-pass' }[decision] ?? 'badge-pass';
}

/**
 * Display label for a scan decision.
 * @param {ScanDecision} decision
 * @returns {string}
 */
export function decisionLabel(decision) {
  return { HOT: '🔥 HOT', LIST: '✅ FLIP', SKIP: '❌ PASS' }[decision] ?? 'PASS';
}
