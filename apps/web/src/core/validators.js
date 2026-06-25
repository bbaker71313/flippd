/**
 * Input validation and data-integrity checks.
 * Pure functions — return { valid: bool, error?: string }.
 */

/**
 * @param {{ username?: string, email?: string, password?: string, confirm?: string, name?: string }} fields
 * @param {'login'|'register'} mode
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateAuthFields(fields, mode) {
  if (mode === 'register') {
    const { name, username, email, password, confirm } = fields;
    if (!name)                                return { valid: false, error: 'Enter your first name' };
    if (!username)                            return { valid: false, error: 'Choose a username' };
    if (!/^[a-zA-Z0-9_]+$/.test(username))   return { valid: false, error: 'Username: letters, numbers, underscores only' };
    if (!email || !email.includes('@'))       return { valid: false, error: 'Enter a valid email address' };
    if (password.length < 6)                  return { valid: false, error: 'Password must be at least 6 characters' };
    if (password !== confirm)                 return { valid: false, error: 'Passwords do not match' };
    return { valid: true };
  }

  // login
  const { username, password } = fields;
  if (!username) return { valid: false, error: 'Enter your username or email' };
  if (!password) return { valid: false, error: 'Enter your password' };
  return { valid: true };
}

/**
 * Check if an item would be a duplicate in the current inventory.
 * @param {{ nickname?: string, sku?: string }} newItem
 * @param {Array<{ nickname: string, sku: string }>} existingItems
 * @returns {object|null} The duplicate, or null
 */
export function findDuplicate(newItem, existingItems) {
  if (!newItem.nickname) return null;
  const norm = s => String(s || '').toLowerCase().trim();
  const n = norm(newItem.nickname);
  return existingItems.find(i =>
    (newItem.sku && i.sku && norm(i.sku) === norm(newItem.sku)) ||
    norm(i.nickname) === n
  ) ?? null;
}

/**
 * Validate inventory item fields before save.
 * @param {{ nickname?: string, sellPrice?: string|number, cost?: string|number }} fields
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateInventoryItem(fields) {
  if (!fields.nickname || !String(fields.nickname).trim()) {
    return { valid: false, error: 'Item name is required' };
  }
  const price = parseFloat(fields.sellPrice);
  if (isNaN(price) || price < 0) {
    return { valid: false, error: 'Enter a valid sell price' };
  }
  return { valid: true };
}

/**
 * Validate user settings values.
 * @param {Record<string, unknown>} s
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSettings(s) {
  const errors = [];
  if (s.ebayFee == null || s.ebayFee < 0 || s.ebayFee > 50) errors.push('eBay fee must be 0–50%');
  if (s.minProfit == null || s.minProfit < 0)               errors.push('Min profit must be ≥ 0');
  if (s.targetRoi == null || s.targetRoi < 0)               errors.push('Target ROI must be ≥ 0');
  if (s.mileageRate == null || s.mileageRate < 0)           errors.push('Mileage rate must be ≥ 0');
  if (s.taxReservePct == null || s.taxReservePct < 0 || s.taxReservePct > 1) {
    errors.push('Tax reserve must be 0–100%');
  }
  return { valid: errors.length === 0, errors };
}
