/**
 * Settings state slice.
 * Owns the user's sourcing configuration.
 * All business logic reads settings through this slice — never from DOM or globals.
 */

import { bus } from './AppState.js';
import {
  loadSettings as loadFromStorage,
  saveSettings as saveToStorage,
  clearSettings,
} from '../services/storage/local.js';

/**
 * @typedef {Object} Settings
 * @property {number}  minProfit        - Minimum profit to consider a flip
 * @property {number}  targetRoi        - Target ROI percentage
 * @property {number}  maxDays          - Stale item threshold in days
 * @property {number}  minStr           - Minimum sell-through rate
 * @property {number}  ebayFee          - eBay fee percentage (NEVER hardcode)
 * @property {number}  pkgCost          - Packaging cost
 * @property {'buyer'|'free'} shipping  - Who pays shipping
 * @property {number}  shipCost         - Shipping cost when seller pays
 * @property {'conservative'|'balanced'|'aggressive'} style
 * @property {string}  removebgKey      - remove.bg API key
 * @property {boolean} exportReminderEnabled
 * @property {string}  exportReminderTime
 * @property {number}  taxReservePct    - Tax reserve percentage (NEVER hardcode)
 * @property {number}  mileageRate      - IRS mileage rate (NEVER hardcode)
 */

/** @type {Settings} */
export const DEFAULTS = {
  minProfit:             15,
  targetRoi:             200,
  maxDays:               60,
  minStr:                0,
  ebayFee:               13,
  pkgCost:               1.25,
  shipping:              'buyer',
  shipCost:              6.00,
  style:                 'balanced',
  removebgKey:           '',
  exportReminderEnabled: false,
  exportReminderTime:    '09:00',
  taxReservePct:         0.25,
  mileageRate:           0.67,
};

/** @type {Settings} */
let _settings = { ...DEFAULTS };

// ── Initialisation ─────────────────────────────────────────────────────────

/**
 * Load settings from localStorage, falling back to defaults for missing keys.
 * @returns {Settings}
 */
export function initSettings() {
  const stored = loadFromStorage();
  if (stored) {
    _settings = { ...DEFAULTS, ...stored };
  } else {
    _settings = { ...DEFAULTS };
  }
  return _settings;
}

// ── Selectors ──────────────────────────────────────────────────────────────

/** @returns {Settings} */
export function getSettings() { return _settings; }

/** @param {keyof Settings} key @returns {unknown} */
export function getSetting(key) { return _settings[key]; }

// ── Mutations ──────────────────────────────────────────────────────────────

/**
 * Update one or more settings keys.
 * @param {Partial<Settings>} updates
 */
export function updateSettings(updates) {
  _settings = { ..._settings, ...updates };
  saveToStorage(_settings);
  bus.emit('settings:changed', { settings: _settings });
}

/**
 * Reset all settings to defaults.
 */
export function resetSettings() {
  _settings = { ...DEFAULTS };
  clearSettings();
  bus.emit('settings:changed', { settings: _settings });
}
