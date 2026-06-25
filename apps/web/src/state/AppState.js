/**
 * Central application state with a lightweight pub/sub event bus.
 *
 * Design:
 * - One global state object (no framework dependency)
 * - State is only mutated through named setters
 * - Subscribers receive change events so UI can re-render
 * - Slices (ItemsSlice, SettingsSlice) own their domain
 */

/** @typedef {(event: { type: string, payload: unknown }) => void} Listener */

class EventBus {
  constructor() {
    /** @type {Map<string, Set<Listener>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to a state change event.
   * @param {string} type
   * @param {Listener} fn
   * @returns {() => void} unsubscribe
   */
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type)?.delete(fn);
  }

  /**
   * Emit a state change.
   * @param {string} type
   * @param {unknown} payload
   */
  emit(type, payload) {
    this._listeners.get(type)?.forEach(fn => fn({ type, payload }));
    this._listeners.get('*')?.forEach(fn => fn({ type, payload }));
  }
}

export const bus = new EventBus();

/**
 * Core app-level state (auth, navigation, UI flags).
 * Domain state lives in ItemsSlice / SettingsSlice.
 */
export const AppState = {
  // Auth
  currentUser:  null,
  jwt:          '',
  isLoggedIn:   false,

  // Navigation
  activeTab:    'sourcing',
  srcView:      'input',   // 'input' | 'results' | 'shelf' | 'settings' | 'setup'
  invView:      'home',    // 'home' | 'list' | 'detail' | 'form'

  // UI flags
  isLoading:    false,
  authMode:     'login',   // 'login' | 'register' | 'verify' | 'forgot' | 'reset'
};

/**
 * Update auth state after login.
 * @param {{ jwt: string, user: object }} payload
 */
export function setAuth({ jwt, user }) {
  AppState.jwt        = jwt;
  AppState.currentUser = user;
  AppState.isLoggedIn = !!jwt;
  bus.emit('auth:changed', { user, isLoggedIn: AppState.isLoggedIn });
}

/**
 * Clear auth state on logout.
 */
export function clearAuth() {
  AppState.jwt         = '';
  AppState.currentUser = null;
  AppState.isLoggedIn  = false;
  bus.emit('auth:changed', { user: null, isLoggedIn: false });
}

/**
 * Update the active tab and emit navigation event.
 * @param {string} tab
 */
export function setActiveTab(tab) {
  AppState.activeTab = tab;
  bus.emit('nav:tabChanged', { tab });
}

/**
 * Update the scanner sub-view.
 * @param {string} view
 */
export function setSrcView(view) {
  AppState.srcView = view;
  bus.emit('nav:srcViewChanged', { view });
}

/**
 * Update the inventory sub-view.
 * @param {string} view
 */
export function setInvView(view) {
  AppState.invView = view;
  bus.emit('nav:invViewChanged', { view });
}

/**
 * Set the auth form mode.
 * @param {'login'|'register'|'verify'|'forgot'|'reset'} mode
 */
export function setAuthMode(mode) {
  AppState.authMode = mode;
  bus.emit('auth:modeChanged', { mode });
}
