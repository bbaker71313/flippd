/**
 * Authentication service.
 * Email verification + password only — magic links were removed in backend v3.
 */

import { apiFetch, ENDPOINTS, ApiError } from './http.js';
import { getJwt, setJwt, clearJwt, setUserName, clearSettings } from './storage/local.js';

/**
 * @typedef {Object} AuthUser
 * @property {string} id
 * @property {string} email
 * @property {string} username
 * @property {string} name
 * @property {string} tier
 * @property {boolean} emailVerified
 * @property {number} [scanCount]
 * @property {number} [itemCount]
 */

/**
 * Register a new user.
 * @param {{ name: string, username: string, email: string, password: string }} fields
 * @returns {Promise<{ success: boolean }>}
 */
export async function register(fields) {
  return apiFetch(`${ENDPOINTS.AUTH}/register`, {
    method: 'POST',
    body: JSON.stringify(fields),
  });
}

/**
 * Log in with username/email + password.
 * Stores the JWT in localStorage on success.
 * @param {{ username: string, password: string }} fields
 * @returns {Promise<AuthUser>}
 */
export async function login(fields) {
  const data = await apiFetch(`${ENDPOINTS.AUTH}/login`, {
    method: 'POST',
    body: JSON.stringify(fields),
  });

  if (data.token) {
    setJwt(data.token);
    if (data.user?.name) setUserName(data.user.name);
  }

  return data.user ?? data;
}

/**
 * Fetch the current user's profile.
 * @returns {Promise<AuthUser>}
 */
export async function getMe() {
  return apiFetch(`${ENDPOINTS.AUTH}/me`);
}

/**
 * Sign out — clears local token.
 * Best-effort call to backend; failure still signs out locally.
 */
export async function logout() {
  try {
    await apiFetch(`${ENDPOINTS.AUTH}/logout`, { method: 'POST' });
  } catch (_) {}
  clearJwt();
}

/**
 * Request a password reset email.
 * @param {string} email
 * @returns {Promise<void>}
 */
export async function requestPasswordReset(email) {
  await apiFetch(`${ENDPOINTS.AUTH}/request-reset`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Submit a new password with the reset token from the email link.
 * @param {string} token
 * @param {string} password
 * @returns {Promise<void>}
 */
export async function submitPasswordReset(token, password) {
  await apiFetch(`${ENDPOINTS.AUTH}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

/**
 * Returns true if a JWT is stored locally (user appears logged in).
 */
export function hasToken() {
  return !!getJwt();
}
