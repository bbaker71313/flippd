// Shared JWT + auth helpers for all Edge Functions (§4.2 dedup).
// Single implementation — previously copied verbatim into auth, claude-proxy,
// stripe-checkout, ebay-oauth. Secret is passed in by the caller, which reads it
// from Deno.env and fail-closes at the request entrypoint (no fallback secret — SEC-001).

export function b64url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 90 * 24 * 60 * 60,
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

export async function getAuthedUserId(req: Request, jwtSecret: string): Promise<number | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = await verifyJWT(authHeader.slice(7), jwtSecret);
    return payload.sub as number;
  } catch {
    return null;
  }
}

// Like getAuthedUserId, but also enforces JWT revocation (SEC-012): rejects a token
// whose token_version is stale vs the user's current value. Use this for EVERY
// authenticated endpoint — getAuthedUserId alone does NOT check revocation, so a
// token issued before a password reset would otherwise still be accepted.
// `supabase` is a service-role client (structurally typed to avoid pulling supabase-js types).
export async function getAuthedUserIdChecked(
  req: Request,
  jwtSecret: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<number | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const payload = await verifyJWT(authHeader.slice(7), jwtSecret);
    const { data } = await supabase
      .from('users').select('token_version').eq('id', payload.sub).maybeSingle();
    if (!data) return null;
    if ((payload.token_version ?? 0) !== ((data.token_version as number) ?? 0)) return null;
    return payload.sub as number;
  } catch {
    return null;
  }
}
