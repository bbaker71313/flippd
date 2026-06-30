// Stripe Checkout Session creator + Customer Portal
// Price IDs from env vars — never hardcoded
// POST /          → { url } — checkout session
// POST /portal    → { url } — billing portal session

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getAuthedUserIdChecked } from "../_shared/jwt.ts"
import { corsHeaders } from "../_shared/cors.ts"

const PRICE_ID_MAP: Record<string, string> = {
  hustle_monthly: 'STRIPE_PRICE_HUSTLE_MONTHLY',
  stack_monthly:  'STRIPE_PRICE_STACK_MONTHLY',
  empire_monthly: 'STRIPE_PRICE_EMPIRE_MONTHLY',
};

Deno.serve(async (req: Request) => {
  // SEC-015: local json closes over req for dynamic locked-origin CORS.
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(req.url);
  const isPortal = url.pathname.endsWith('/portal');

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 503);

  const jwtSecret = Deno.env.get('JWT_SECRET');
  if (!jwtSecret) throw new Error('JWT_SECRET must be set');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

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

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: portalParams.toString(),
    });

    const portalSession = await portalRes.json() as Record<string, unknown>;
    if (!portalRes.ok) {
      return json({ error: (portalSession.error as Record<string, unknown>)?.message ?? 'Stripe portal error' }, 500);
    }

    return json({ url: portalSession.url });
  }

  // Checkout session — require authenticated user (SEC-007)
  const userId = await getAuthedUserIdChecked(req, jwtSecret, supabase);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  const tier      = (body.tier as string) ?? 'hustle';
  const interval  = (body.interval as string) ?? 'monthly';
  const returnUrl = (body.returnUrl as string) ?? 'scanforprofit://subscription/success';

  const normalizedInterval = interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : interval;
  const priceKey = tier.includes('_') ? tier : `${tier}_${normalizedInterval}`;
  const envKey   = PRICE_ID_MAP[priceKey];
  if (!envKey) return json({ error: `Unknown tier: ${tier}` }, 400);

  const priceId = Deno.env.get(envKey);
  if (!priceId) return json({ error: `Price ID not configured for ${priceKey}` }, 503);

  const params = new URLSearchParams({
    'mode':                    'subscription',
    'line_items[0][price]':    priceId,
    'line_items[0][quantity]': '1',
    'success_url':             returnUrl + '?status=success',
    'cancel_url':              returnUrl + '?status=cancel',
    'allow_promotion_codes':   'true',
  });

  params.set('client_reference_id', String(userId));

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await stripeRes.json() as Record<string, unknown>;
  if (!stripeRes.ok) return json({ error: (session.error as Record<string, unknown>)?.message ?? 'Stripe error' }, 500);

  return json({ url: session.url, sessionId: session.id });
});
