// Shared JWT + auth helpers for all Edge Functions (§4.2 dedup).
// Single implementation — previously copied verbatim into auth, claude-proxy,
// stripe-checkout, ebay-oauth. Secret is passed in by the caller, which reads it
// from Deno.env and fail-closes at the request entrypoint (no fallback secret — SEC-001).

export function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Random hex string of `bytes` random bytes (e.g. for tokens/nonces). §4.2 dedup —
// previously copied verbatim into auth and ebay-oauth.
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// P2-29: session policy — absolute lifetime only, no renewal/refresh and no
// idle-based expiry (the product doesn't track activity for this). A session
// is valid for exactly DEFAULT_SESSION_SECONDS from login, then the user
// must re-authenticate; there is no silent token refresh. This default must
// stay equal to authCookie()'s Max-Age in auth/index.ts — a JWT that outlives
// its cookie is a dead value the browser never presents, but a JWT that
// expires *before* the cookie does nothing wrong either; the real risk this
// closes is the other direction (a JWT that outlives the cookie would still
// verify if the raw token were ever extracted/replayed outside the cookie,
// e.g. via an XSS bug or a copied dev-tools value, for as long as it remains
// unexpired). Callers needing a shorter-lived, special-purpose token (email
// verification, password reset, the eBay OAuth `state` CSRF token) already
// pass an explicit expiresInSeconds override — this default only governs the
// login session token.
//
// Rotating JWT_SECRET immediately invalidates every previously-issued
// token (HMAC verification fails), forcing every logged-in user to
// re-authenticate — expected and unavoidable with a single shared signing
// secret; there is no rotation-with-grace-period support.
const DEFAULT_SESSION_SECONDS = 30 * 24 * 60 * 60;

export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = DEFAULT_SESSION_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${body}.${sigB64}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, payload, sig] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!valid) throw new Error('Invalid signature');
  const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  if (data.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');
  return data;
}

// SEC-015: extract JWT from httpOnly cookie (no Bearer fallback).
// Cookie name: sfp_auth. Value is URL-encoded.
export function jwtFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get('Cookie') ?? '';
  const match = /(?:^|;\s*)sfp_auth=([^;]+)/.exec(cookieHeader);
  return match ? decodeURIComponent(match[1]) : null;
}

// Enforces JWT revocation (SEC-012): rejects a token whose token_version is stale
// vs the user's current value. Use this for EVERY authenticated endpoint — a token
// issued before a password reset must not still be accepted.
// SEC-015: cookie-only — no Bearer fallback.
// `supabase` is a service-role client (structurally typed to avoid pulling supabase-js types).
export async function getAuthedUserIdChecked(
  req: Request,
  jwtSecret: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<number | null> {
  const token = jwtFromCookie(req);
  if (!token) return null;
  try {
    const payload = await verifyJWT(token, jwtSecret);
    const { data } = await supabase
      .from('users').select('token_version').eq('id', payload.sub).maybeSingle();
    if (!data) return null;
    if ((payload.token_version ?? 0) !== ((data.token_version as number) ?? 0)) return null;
    return payload.sub as number;
  } catch {
    return null;
  }
}
