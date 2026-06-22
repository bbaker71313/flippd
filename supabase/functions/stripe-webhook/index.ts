import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

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

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) return false;

  // Reject stale events (> 5 minutes)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expectedSig = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expectedHex = Array.from(new Uint8Array(expectedSig), b => b.toString(16).padStart(2, '0')).join('');
  return expectedHex === sig;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('RESEND_FROM_EMAIL') ?? 'ScanForProfit <hello@scanforprofit.com>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) console.error('Resend error:', await res.text());
}

// Stripe Price ID → tier mapping (from HANDOFF.md)
const PRICE_TIER: Record<string, string> = {
  'price_1Tb4hLId3kJSEdqMH7SYN3a8': 'hustle',  // Hustle monthly
  'price_1Tb4hOId3kJSEdqMiMUrnFm2': 'hustle',  // Hustle annual
  'price_1Tb4hRId3kJSEdqMq9XwGKbZ': 'stack',   // Stack monthly
  'price_1Tb4hTId3kJSEdqMB21L5giT': 'stack',   // Stack annual
  'price_1Tb4hWId3kJSEdqMFrtyqDkK': 'empire',  // Empire monthly
  // empire_annual: add price ID here once created in Stripe (no price exists yet)
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!webhookSecret || !stripeKey) {
    console.error('Stripe secrets not configured');
    return json({ error: 'Not configured' }, 503);
  }

  const sigHeader = req.headers.get('stripe-signature');
  if (!sigHeader) return json({ error: 'Missing Stripe signature' }, 400);

  const rawBody = await req.text();
  const isValid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!isValid) return json({ error: 'Invalid Stripe signature' }, 400);

  let event: { type: string; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const data = event.data.object as Record<string, unknown>;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const customerId = data['customer'] as string;
        const subscriptionId = data['subscription'] as string;
        const customerEmail = (data['customer_details'] as Record<string, unknown>)?.['email'] as string
          ?? data['customer_email'] as string;

        if (!subscriptionId) break;

        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` },
        });
        const sub = await subRes.json();
        const priceId = (sub.items?.data?.[0]?.price?.id) as string;
        const tier = PRICE_TIER[priceId] ?? 'hustle';
        const periodEnd = sub.current_period_end
          ? new Date((sub.current_period_end as number) * 1000).toISOString()
          : null;

        const lookupField = customerEmail ? 'email' : 'stripe_customer_id';
        const lookupValue = customerEmail ?? customerId;
        const { data: user } = await supabase
          .from('users').select('id').eq(lookupField, lookupValue).maybeSingle();

        if (user) {
          await supabase.from('users').update({
            tier,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: 'active',
            subscription_period_end: periodEnd,
          }).eq('id', user.id);

          const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
          const appUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
          const emailTo = customerEmail ?? lookupValue;
          if (emailTo) {
            sendEmail(
              emailTo,
              `You're now on ${tierLabel} — welcome to the upgrade`,
              `<h2>You're on ${tierLabel}! 🎉</h2>
<p>Your account has been upgraded. Everything is ready — no setup needed.</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Open ScanForProfit &rarr;</a></p>
<p style="color:#888;font-size:12px;">Questions? Reply to this email.</p>`,
            ).catch(console.error);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const customerId = data['customer'] as string;
        const subscriptionId = data['id'] as string;
        const status = data['status'] as string;
        const items = data['items'] as Record<string, unknown>;
        const priceId = (items?.['data'] as Array<Record<string, unknown>>)?.[0]?.['price'] as Record<string, unknown>;
        const tier = PRICE_TIER[(priceId?.['id'] as string) ?? ''] ?? 'hustle';
        const periodEnd = data['current_period_end']
          ? new Date((data['current_period_end'] as number) * 1000).toISOString()
          : null;

        await supabase.from('users').update({
          tier,
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
          subscription_period_end: periodEnd,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.deleted': {
        const customerId = data['customer'] as string;
        await supabase.from('users').update({
          tier: 'scout',
          stripe_subscription_id: null,
          subscription_status: 'canceled',
          subscription_period_end: null,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'invoice.payment_failed': {
        const customerId = data['customer'] as string;
        await supabase.from('users').update({
          subscription_status: 'past_due',
        }).eq('stripe_customer_id', customerId);

        const { data: failedUser } = await supabase
          .from('users').select('email, username').eq('stripe_customer_id', customerId).maybeSingle();
        if (failedUser?.email) {
          const appUrl = Deno.env.get('FRONTEND_URL') ?? 'https://scanforprofit.com';
          sendEmail(
            failedUser.email,
            'Payment failed — update your billing info',
            `<h2>We couldn't process your payment</h2>
<p>Hi ${failedUser.username ?? 'there'},</p>
<p>Your last payment failed. To keep your subscription active, please update your billing information.</p>
<p><a href="${appUrl}/app.html" style="display:inline-block;padding:12px 24px;background:#d4a843;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Update Billing &rarr;</a></p>
<p style="color:#888;font-size:12px;">If you think this is a mistake, reply to this email and we'll sort it out.</p>`,
          ).catch(console.error);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return json({ error: 'Handler error' }, 500);
  }
});
