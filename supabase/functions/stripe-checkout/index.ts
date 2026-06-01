// Stripe Checkout Session creator
// Price IDs from env vars — never hardcoded
// Returns { url } — mobile opens in WebBrowser

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const PRICE_ID_MAP: Record<string, string> = {
  hustle_monthly: 'STRIPE_PRICE_HUSTLE_MONTHLY',
  stack_monthly:  'STRIPE_PRICE_STACK_MONTHLY',
  empire_monthly: 'STRIPE_PRICE_EMPIRE_MONTHLY',
  hustle_annual:  'STRIPE_PRICE_HUSTLE_ANNUAL',
  stack_annual:   'STRIPE_PRICE_STACK_ANNUAL',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Stripe not configured' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON body' }, 400); }

  // tier: 'hustle' | 'stack' | 'empire' | full key like 'hustle_monthly'
  const tier      = (body.tier as string) ?? 'hustle';
  const interval  = (body.interval as string) ?? 'monthly';
  const userId    = body.userId as string | undefined;
  const returnUrl = (body.returnUrl as string) ?? 'scanforprofit://subscription/success';

  const priceKey = tier.includes('_') ? tier : `${tier}_${interval}`;
  const envKey   = PRICE_ID_MAP[priceKey];
  if (!envKey) return json({ error: `Unknown tier: ${tier}` }, 400);

  const priceId = Deno.env.get(envKey);
  if (!priceId) return json({ error: `Price ID not configured for ${priceKey}` }, 503);

  // Create Stripe Checkout Session
  const params = new URLSearchParams({
    'mode':                   'subscription',
    'line_items[0][price]':   priceId,
    'line_items[0][quantity]': '1',
    'success_url':            returnUrl + '?status=success',
    'cancel_url':             returnUrl + '?status=cancel',
    'allow_promotion_codes':  'true',
  });

  if (userId) params.set('client_reference_id', userId);

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
