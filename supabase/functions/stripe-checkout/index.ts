// Stripe Checkout Session creator + Customer Portal
// Price IDs from env vars — never hardcoded
// POST /          → { url } — checkout session
// POST /portal    → { url } — billing portal session

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getAuthedUserIdChecked } from "../_shared/jwt.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { isPaidTier, normalizeInterval, priceEnvVarName, resolvePriceId } from "../_shared/stripePricing.ts"
import { deriveCheckoutIdempotencyKey } from "../_shared/stripeIdempotency.ts"
import { externalCall, ExternalCallError } from "../_shared/externalCall.ts"

function stripeErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ExternalCallError) || !err.bodyText) return fallback;
  try {
    const parsed = JSON.parse(err.bodyText) as Record<string, unknown>;
    const inner = parsed.error as Record<string, unknown> | undefined;
    return (inner?.message as string) ?? fallback;
  } catch {
    return fallback;
  }
}

// P1-I: extracted (and the supabase client made an injectable parameter, same
// pattern as ebay-oauth/claude-proxy's handlers) so P1-K workflow tests can
// drive it directly against a fake supabase instead of a live project.
// Deno.serve is guarded behind import.meta.main so this module can be
// imported by tests without starting a listener — zero deployed-behavior
// change; the real client is still constructed the same way, just one level
// out (see the import.meta.main block below).
export async function handleCheckoutRequest(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response> {
  // SEC-015: local json closes over req for dynamic locked-origin CORS.
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  // SEC-015 CSRF guard: non-simple header forces CORS preflight; cross-site requests cannot set it.
  if (!req.headers.get('x-sfp-client')) return json({ error: 'Forbidden' }, 403);

  const url = new URL(req.url);
  const isPortal = url.pathname.endsWith('/portal');

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 503);

  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) throw new Error('JWT_SECRET must be set');

  if (isPortal) {
    const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    const { data: user } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .maybeSingle();

    if (!user?.stripe_customer_id) {
      return json({ error: 'No Stripe subscription found. Please upgrade first.' }, 400);
    }

    const returnUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
    const portalParams = new URLSearchParams({
      customer: user.stripe_customer_id,
      return_url: returnUrl + '/app.html',
    });

    let portalSession: Record<string, unknown>;
    try {
      // Creating an extra billing-portal login link on retry is harmless (no
      // duplicate side effect), so this is safe to mark isIdempotent for the
      // P2-18 bounded transient retry — no Stripe Idempotency-Key needed
      // (P2-26 scopes the idempotency *key* requirement to Checkout Session
      // creation, which does have a duplicate-subscription-risk side effect).
      portalSession = await externalCall<Record<string, unknown>>(
        'https://api.stripe.com/v1/billing_portal/sessions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: portalParams.toString(),
        },
        { timeoutMs: 10_000, maxRetries: 2, isIdempotent: true },
        (r) => r.json() as Promise<Record<string, unknown>>,
      );
    } catch (err) {
      return json({ error: stripeErrorMessage(err, 'Stripe portal error') }, 500);
    }

    return json({ url: portalSession.url });
  }

  // Checkout session — require authenticated user (SEC-007)
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const tierRaw   = (body.tier as string) ?? 'hustle';
  // Legacy callers may pass a combined key like "stack_annual" — split it so
  // the same tier/interval config resolution applies either way.
  const [tierPart, intervalPart] = tierRaw.includes('_') ? tierRaw.split('_', 2) : [tierRaw, undefined];
  const tier      = tierPart;
  const interval  = normalizeInterval((body.interval as string) ?? intervalPart);
  const returnUrl = (body.returnUrl as string) ?? 'scanforprofit://subscription/success';

  if (!isPaidTier(tier)) return json({ error: `Unknown tier: ${tier}` }, 400);

  // P1-B: single authoritative tier/interval -> price id config, shared with
  // stripe-webhook's reverse lookup. Never invent a missing price id — fail
  // closed and name exactly which secret is missing.
  const priceId = resolvePriceId(tier, interval);
  if (!priceId) {
    return json({ error: `Price ID not configured for ${tier} (${interval}) — set ${priceEnvVarName(tier, interval)}` }, 503);
  }

  const params = new URLSearchParams({
    'mode':                    'subscription',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': '1',
    'success_url':             returnUrl + '?status=success',
    'cancel_url':              returnUrl + '?status=cancel',
    'allow_promotion_codes':   'true',
  });

  params.set('client_reference_id', String(userId));

  // P2-26: idempotency key scoped to (server-derived userId, tier, interval,
  // client attemptId) — a retried submission of the same click reuses the
  // same Stripe Checkout Session instead of creating a duplicate, while a
  // different tier/interval or a later deliberate attempt (new attemptId)
  // gets a fresh one. userId always comes from the verified JWT above, never
  // from the request body, so a client can't forge this key to collide with
  // another user's checkout.
  const idempotencyKey = await deriveCheckoutIdempotencyKey({
    userId: String(userId),
    tier,
    interval,
    attemptId: typeof body.attemptId === 'string' ? body.attemptId : null,
  });

  let session: Record<string, unknown>;
  try {
    session = await externalCall<Record<string, unknown>>(
      'https://api.stripe.com/v1/checkout/sessions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type':  'application/x-www-form-urlencoded',
          'Idempotency-Key': idempotencyKey,
        },
        body: params.toString(),
      },
      // Idempotency-Key makes this POST safe to retry on a transient failure.
      { timeoutMs: 15_000, maxRetries: 2, isIdempotent: true },
      (r) => r.json() as Promise<Record<string, unknown>>,
    );
  } catch (err) {
    return json({ error: stripeErrorMessage(err, 'Stripe error') }, 500);
  }

  return json({ url: session.url, sessionId: session.id });
}

if (import.meta.main) {
  Deno.serve((req: Request) => {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    return handleCheckoutRequest(req, supabase);
  });
}
