/**
 * SKU generation utilities.
 * Pure functions — no state, no side effects.
 */

import { SKU_PREFIXES } from './categories.js';

/**
 * Generate a zero-padded SKU from category prefix + numeric ID.
 * @param {string} category
 * @param {number} sequenceNum  - the next unused integer for this prefix
 * @returns {string}  e.g. "ELC-00042"
 */
export function generateSKU(category, sequenceNum) {
  const prefix = SKU_PREFIXES[category] ?? 'GEN';
  const n = String(sequenceNum).padStart(5, '0');
  return `${prefix}-${n}`;
}

/**
 * Get the next available sequence number for a given category prefix,
 * given the existing list of items.
 * @param {string} category
 * @param {Array<{ sku: string }>} existingItems
 * @returns {number}
 */
export function nextSequence(category, existingItems) {
  const prefix = SKU_PREFIXES[category] ?? 'GEN';
  let max = 0;
  for (const item of existingItems) {
    if (item.sku && item.sku.startsWith(prefix + '-')) {
      const num = parseInt(item.sku.slice(prefix.length + 1), 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  return max + 1;
}

/**
 * Generate the next available SKU for a category, given existing items.
 * @param {string} category
 * @param {Array<{ sku: string }>} existingItems
 * @returns {string}
 */
export function nextSKU(category, existingItems) {
  return generateSKU(category, nextSequence(category, existingItems));
}
