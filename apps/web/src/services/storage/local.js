/**
 * Typed localStorage adapter.
 * Centralises all key names and parse/serialise logic.
 * Never import localStorage directly outside this module.
 */

const KEYS = {
  items:         'sfp_items_v1',
  jwt:           'sfp_jwt',
  userName:      'sfp_user_name',
  seeded:        'sfp_seeded',
  settings:      'fif_settings',
  scanLog:       'sfp_scan_log',
  activityLog:   'sfp_activity_log',
  csvExported:   'sfp_csv_exported_ids',
  csvQueueBase:  'sfp_csv_queue',
};

/** Migrate stale keys from pre-rebrand versions — run once at startup. */
export function migrateStaleKeys() {
  try {
    const legacyPairs = [
      ['ebayhq_items_v1',   KEYS.items],
      ['flippd_items_v1',   KEYS.items],
      ['flippd_jwt',        KEYS.jwt],
      ['flippd_user_name',  KEYS.userName],
      ['flippd_seeded',     KEYS.seeded],
    ];
    for (const [oldKey, newKey] of legacyPairs) {
      const val = localStorage.getItem(oldKey);
      if (val !== null) {
        if (!localStorage.getItem(newKey)) localStorage.setItem(newKey, val);
        localStorage.removeItem(oldKey);
      }
    }
  } catch (_) {}
}

// ── Items ─────────────────────────────────────────────────────────────────

/** @returns {object[]} */
export function loadItems() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.items) || 'null') ?? null;
  } catch (_) {
    return null;
  }
}

/** @param {object[]} items */
export function saveItems(items) {
  localStorage.setItem(KEYS.items, JSON.stringify(items));
}

// ── Auth ──────────────────────────────────────────────────────────────────

export function getJwt()       { return localStorage.getItem(KEYS.jwt) ?? ''; }
export function setJwt(t)      { localStorage.setItem(KEYS.jwt, t); }
export function clearJwt()     { localStorage.removeItem(KEYS.jwt); }
export function getUserName()  { return localStorage.getItem(KEYS.userName) ?? ''; }
export function setUserName(n) { localStorage.setItem(KEYS.userName, n); }

// ── Settings ──────────────────────────────────────────────────────────────

/** @returns {object|null} */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/** @param {object} s */
export function saveSettings(s) {
  localStorage.setItem(KEYS.settings, JSON.stringify(s));
}

export function clearSettings() { localStorage.removeItem(KEYS.settings); }

// ── Seeded flag ───────────────────────────────────────────────────────────

export function isSeeded()     { return localStorage.getItem(KEYS.seeded) === '1'; }
export function markSeeded()   { localStorage.setItem(KEYS.seeded, '1'); }

// ── Scan log ──────────────────────────────────────────────────────────────

/** @returns {object[]} */
export function loadScanLog() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.scanLog) || '[]');
  } catch (_) { return []; }
}

/** @param {object[]} log */
export function saveScanLog(log) {
  localStorage.setItem(KEYS.scanLog, JSON.stringify(log));
}

// ── Activity log ──────────────────────────────────────────────────────────

/** @returns {object[]} */
export function loadActivityLog() {
  try {
    return JSON.parse(localStorage.getItem(KEYS.activityLog) || '[]');
  } catch (_) { return []; }
}

/** @param {object[]} log */
export function saveActivityLog(log) {
  localStorage.setItem(KEYS.activityLog, JSON.stringify(log));
}

// ── CSV export tracking ───────────────────────────────────────────────────

/** @returns {Set<string>} */
export function loadExportedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEYS.csvExported) || '[]'));
  } catch (_) { return new Set(); }
}

/** @param {string[]} ids */
export function markExported(ids) {
  const existing = loadExportedIds();
  ids.forEach(id => existing.add(String(id)));
  localStorage.setItem(KEYS.csvExported, JSON.stringify([...existing]));
}

// ── CSV export queue ──────────────────────────────────────────────────────

/** @param {string} userId */
function csvQueueKey(userId) {
  return `${KEYS.csvQueueBase}_${userId}`;
}

/** @param {string} userId @returns {Set<string>} */
export function loadCsvQueue(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(csvQueueKey(userId)) || '[]'));
  } catch (_) { return new Set(); }
}

/** @param {string} userId @param {Set<string>} queue */
export function saveCsvQueue(userId, queue) {
  localStorage.setItem(csvQueueKey(userId), JSON.stringify([...queue]));
}
