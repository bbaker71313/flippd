/**
 * Authenticated HTTP client.
 * All API calls flow through here so auth headers, error shapes,
 * and base URLs live in exactly one place.
 */

export const ENDPOINTS = {
  AUTH:   'https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/auth',
  EBAY:   'https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/ebay-oauth',
  CLAUDE: 'https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/claude-proxy',
  STRIPE: 'https://dqgfpchkheznvanfgsmx.supabase.co/functions/v1/stripe-checkout',
};

/**
 * @typedef {Object} ApiError
 * @property {string} message
 * @property {number} status
 * @property {string} [code]
 */

/**
 * A typed error thrown by all service calls on non-2xx responses.
 */
export class ApiError extends Error {
  /** @param {string} message @param {number} status @param {unknown} body */
  constructor(message, status, body = null) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.body    = body;
  }
}

/** Token getter — injected by the auth module at startup. */
let _getToken = () => '';

/**
 * Wire the token provider. Call once from auth initialisation.
 * @param {() => string} fn
 */
export function setTokenProvider(fn) {
  _getToken = fn;
}

/**
 * Build standard auth headers.
 * @returns {Record<string,string>}
 */
export function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + _getToken(),
  };
}

/**
 * Perform an authenticated JSON fetch.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<unknown>}
 */
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  let body;
  const contentType = res.headers.get('content-type') ?? '';
  try {
    body = contentType.includes('application/json')
      ? await res.json()
      : await res.text();
  } catch (_) {
    body = null;
  }

  if (!res.ok) {
    const message = (body && body.error) || `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return body;
}

/**
 * Perform an authenticated multipart/form-data fetch (for photo uploads).
 * Does NOT set Content-Type — browser sets it with boundary.
 * @param {string} url
 * @param {FormData} formData
 * @returns {Promise<unknown>}
 */
export async function apiUpload(url, formData) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + _getToken() },
    body: formData,
  });

  let body;
  try { body = await res.json(); } catch (_) { body = null; }

  if (!res.ok) {
    const message = (body && body.error) || `HTTP ${res.status}`;
    throw new ApiError(message, res.status, body);
  }

  return body;
}
