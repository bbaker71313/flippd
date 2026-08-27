// eBay Application access token (client_credentials grant) — powers the
// Catalog, Taxonomy, and Browse APIs, which are public/catalog-read APIs
// and do NOT require a user's connected eBay account (unlike ebay-oauth's
// user-authorization flow for selling/inventory).
//
// Reuses the same EBAY_CLIENT_ID/EBAY_CLIENT_SECRET (or EBAY_SANDBOX_*)
// secrets already configured for ebay-oauth — no new credential required.
// If those secrets are not set, callers get an explicit error, never a
// silently-skipped auth step.

import { externalCall, ExternalCallError } from "./externalCall.ts";
import { ebayUrls } from "./ebayClient.ts";

interface EbayAppToken {
  accessToken: string
  expiresAt: number // epoch ms
}

// Per-warm-instance cache only — Edge Functions may cold-start at any time,
// in which case a fresh token is fetched. Never persisted, never logged.
let cachedToken: EbayAppToken | null = null

// P3-38: sandbox/prod URL switching is centralized in ebayClient.ts's
// ebayUrls() — this used to reimplement the exact same EBAY_SANDBOX check
// independently (two copies of the same provider config, drift risk each
// time an endpoint or the sandbox flag's semantics change).
export function ebayApiBase(): string {
  return ebayUrls().api;
}

function ebayTokenUrl(): string {
  return ebayUrls().token;
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
  let data: { access_token?: string; expires_in?: number };
  try {
    // client_credentials grant is safe to retry (no side effect beyond
    // minting a token), so it's marked isIdempotent for P2-18's transient
    // bounded retry despite being a POST.
    data = await externalCall<{ access_token?: string; expires_in?: number }>(
      ebayTokenUrl(),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'https://api.ebay.com/oauth/api_scope',
        }),
      },
      { timeoutMs: 10_000, maxRetries: 2, isIdempotent: true },
      (r) => r.json() as Promise<{ access_token?: string; expires_in?: number }>,
    );
  } catch (err) {
    if (err instanceof ExternalCallError) {
      throw new EbayAppAuthError(`eBay app token request failed: ${err.kind}${err.status ? ` ${err.status}` : ''}`, err);
    }
    throw new EbayAppAuthError('eBay app token request failed (network)', err);
  }

  if (!data.access_token || !data.expires_in) {
    throw new EbayAppAuthError('eBay app token response missing access_token/expires_in');
  }

  cachedToken = { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return cachedToken.accessToken;
}
