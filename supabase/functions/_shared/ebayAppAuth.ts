// eBay Application access token (client_credentials grant) — powers the
// Catalog, Taxonomy, and Browse APIs, which are public/catalog-read APIs
// and do NOT require a user's connected eBay account (unlike ebay-oauth's
// user-authorization flow for selling/inventory).
//
// Reuses the same EBAY_CLIENT_ID/EBAY_CLIENT_SECRET (or EBAY_SANDBOX_*)
// secrets already configured for ebay-oauth — no new credential required.
// If those secrets are not set, callers get an explicit error, never a
// silently-skipped auth step.

interface EbayAppToken {
  accessToken: string
  expiresAt: number // epoch ms
}

// Per-warm-instance cache only — Edge Functions may cold-start at any time,
// in which case a fresh token is fetched. Never persisted, never logged.
let cachedToken: EbayAppToken | null = null

export function ebayApiBase(): string {
  return Deno.env.get('EBAY_SANDBOX') === 'true'
    ? 'https://api.sandbox.ebay.com'
    : 'https://api.ebay.com';
}

function ebayTokenUrl(): string {
  return Deno.env.get('EBAY_SANDBOX') === 'true'
    ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    : 'https://api.ebay.com/identity/v1/oauth2/token';
}

export class EbayAppAuthError extends Error {
  constructor(message: string, public readonly cause?: unknown) { super(message); }
}

// Client-credentials app token. Scope 'https://api.ebay.com/oauth/api_scope'
// is eBay's default public scope — it covers Browse, Catalog, and Taxonomy
// reads and requires no per-user consent.
export async function getEbayAppAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const sandbox = Deno.env.get('EBAY_SANDBOX') === 'true';
  const clientId = Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_ID' : 'EBAY_CLIENT_ID');
  const clientSecret = Deno.env.get(sandbox ? 'EBAY_SANDBOX_CLIENT_SECRET' : 'EBAY_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new EbayAppAuthError('eBay app credentials are not configured (EBAY_CLIENT_ID/EBAY_CLIENT_SECRET)');
  }

  const basicAuth = btoa(`${clientId}:${clientSecret}`);
  let res: Response;
  try {
    res = await fetch(ebayTokenUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    });
  } catch (err) {
    throw new EbayAppAuthError('eBay app token request failed (network)', err);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new EbayAppAuthError(`eBay app token request failed: ${res.status} ${body}`.slice(0, 500));
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token || !data.expires_in) {
    throw new EbayAppAuthError('eBay app token response missing access_token/expires_in');
  }

  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.accessToken;
}
