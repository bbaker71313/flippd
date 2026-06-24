/**
 * Core profit calculation engine.
 * Pure functions — no DOM, no globals, no side effects.
 * All settings passed explicitly so this is trivially testable.
 */

/**
 * @typedef {Object} FeeSettings
 * @property {number} ebayFee     - eBay fee percentage (e.g. 13)
 * @property {number} pkgCost     - Packaging cost in dollars
 * @property {'buyer'|'free'} shipping
 * @property {number} shipCost    - Shipping cost (applied when seller pays)
 * @property {number} taxReservePct
 */

/**
 * @typedef {Object} ProfitResult
 * @property {number} fee
 * @property {number} shipCost
 * @property {number} taxReserve
 * @property {number} totalCosts
 * @property {number} profit
 * @property {number} roi
 */

/**
 * Calculate net profit and ROI for a single item.
 * @param {number} cost - What the reseller paid
 * @param {number} sellPrice - Expected sale price
 * @param {FeeSettings} settings
 * @returns {ProfitResult}
 */
export function calcFinancials(cost, sellPrice, settings) {
  const c = parseFloat(cost) || 0;
  const p = parseFloat(sellPrice) || 0;
  const { ebayFee, pkgCost, shipping, shipCost, taxReservePct } = settings;

  const fee = p * (ebayFee / 100);
  const sellerShipCost = shipping === 'free' ? (shipCost || 0) : 0;
  const taxReserve = p * (taxReservePct || 0);
  const totalCosts = c + pkgCost + sellerShipCost + fee;
  const profit = p - totalCosts;
  const roi = c > 0 ? (profit / c) * 100 : 0;

  return { fee, shipCost: sellerShipCost, taxReserve, totalCosts, profit, roi };
}

/**
 * Simplified profit (used in inventory list views — doesn't need ship cost).
 * @param {number} cost
 * @param {number} sellPrice
 * @param {FeeSettings} settings
 * @returns {number}
 */
export function calcProfit(cost, sellPrice, settings) {
  return calcFinancials(cost, sellPrice, settings).profit;
}

/**
 * Maximum break-even cost to still hit minProfit.
 * @param {number} avgSoldPrice
 * @param {FeeSettings} settings
 * @param {number} minProfit
 * @returns {number}
 */
export function calcMaxCost(avgSoldPrice, settings, minProfit) {
  const p = parseFloat(avgSoldPrice) || 0;
  const { ebayFee, pkgCost, shipping, shipCost } = settings;
  const sellerShipCost = shipping === 'free' ? (shipCost || 0) : 0;
  return p - (p * ebayFee / 100) - pkgCost - minProfit - sellerShipCost;
}

/**
 * Format a profit number as a signed dollar string.
 * @param {number} n
 * @returns {string}
 */
export function formatProfit(n) {
  const abs = Math.abs(n).toFixed(2);
  return n >= 0 ? `$${abs}` : `-$${abs}`;
}

/**
 * Format a number as a dollar amount.
 * @param {number} n
 * @returns {string}
 */
export function formatCurrency(n) {
  return `$${(parseFloat(n) || 0).toFixed(2)}`;
}
