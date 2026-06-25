/**
 * Auth feature controller.
 * Wires auth service → app state → UI.
 */

import * as AuthService from '../services/auth.service.js';
import { setAuth, clearAuth, setAuthMode, AppState } from '../state/AppState.js';
import { setJwt, clearJwt, getJwt } from '../services/storage/local.js';
import { setTokenProvider } from '../services/http.js';
import { validateAuthFields } from '../core/validators.js';
import { showToast } from '../ui/components/Toast.js';
import { bus } from '../state/AppState.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────

/**
 * Wire the JWT provider so http.js can attach auth headers.
 * Call once during app startup.
 */
export function initAuth() {
  setTokenProvider(getJwt);
}

/**
 * Attempt to restore a previous session from the stored JWT.
 * @returns {Promise<import('../services/auth.service.js').AuthUser|null>}
 */
export async function restoreSession() {
  if (!AuthService.hasToken()) return null;
  try {
    const user = await AuthService.getMe();
    setAuth({ jwt: getJwt(), user });
    return user;
  } catch (_) {
    // Token is expired or invalid — clean up
    clearJwt();
    return null;
  }
}

// ── Auth actions ──────────────────────────────────────────────────────────

/**
 * Register a new user.
 * @param {{ name: string, username: string, email: string, password: string, confirm: string }} fields
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function register(fields) {
  const validation = validateAuthFields(fields, 'register');
  if (!validation.valid) return { success: false, error: validation.error };

  try {
    await AuthService.register({
      name:     fields.name,
      username: fields.username,
      email:    fields.email,
      password: fields.password,
    });
    setAuthMode('verify');
    bus.emit('auth:registered', { email: fields.email });
    return { success: true };
  } catch (e) {
    if (e.status === 409) {
      const msg = e.body?.field === 'email'
        ? 'An account with this email already exists.'
        : 'That username is already taken. Please choose another.';
      return { success: false, error: msg };
    }
    return { success: false, error: e.message ?? 'Registration failed. Please try again.' };
  }
}

/**
 * Log in with username/email + password.
 * @param {{ username: string, password: string }} fields
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function login(fields) {
  const validation = validateAuthFields(fields, 'login');
  if (!validation.valid) return { success: false, error: validation.error };

  try {
    const user = await AuthService.login(fields);
    setAuth({ jwt: getJwt(), user });
    if (typeof window.posthog !== 'undefined') {
      window.posthog.identify(user.id, { email: user.email, tier: user.tier });
    }
    bus.emit('auth:loggedIn', { user });
    return { success: true, user };
  } catch (e) {
    if (e.status === 401) {
      return { success: false, error: 'Incorrect username or password.' };
    }
    if (e.status === 403) {
      return { success: false, error: 'Please verify your email before logging in.' };
    }
    return { success: false, error: e.message ?? 'Login failed. Please try again.' };
  }
}

/**
 * Sign out the current user.
 */
export async function logout() {
  await AuthService.logout();
  clearAuth();
  setAuthMode('login');
  bus.emit('auth:loggedOut', {});
  showToast('Signed out');
}

/**
 * Request a password reset email.
 * @param {string} email
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function requestPasswordReset(email) {
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Enter a valid email address' };
  }
  try {
    await AuthService.requestPasswordReset(email);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message ?? 'Could not send reset email.' };
  }
}

/**
 * Submit a new password using a reset token from the email link.
 * @param {{ token: string, password: string, confirm: string }} fields
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function submitPasswordReset(fields) {
  if (!fields.password || fields.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters' };
  }
  if (fields.password !== fields.confirm) {
    return { success: false, error: 'Passwords do not match' };
  }
  try {
    await AuthService.submitPasswordReset(fields.token, fields.password);
    setAuthMode('login');
    showToast('Password updated. Please log in.');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message ?? 'Could not reset password.' };
  }
}
