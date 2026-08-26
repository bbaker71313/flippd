import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { sendEmail } from "../_shared/sendEmail.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { resolveTierFromPriceId } from "../_shared/stripePricing.ts"

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k] = v;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) return false;

  // SEC-019: reject NaN timestamps (parseInt('') = NaN; NaN > 300 = false = bypass)
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const expectedSig = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expectedHex = Array.from(new Uint8Array(expectedSig), b => b.toString(16).padStart(2, '0')).join('');
  // SEC-019: constant-time compare to prevent timing-channel HMAC bypass
  return timingSafeEqual(expectedHex, sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req: Request) => {
  // SEC-015: local json closes over req for dynamic locked-origin CORS.
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
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

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  if (!event.id) return json({ error: 'Event missing id' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // P1-B: persistent idempotency claim. Stripe explicitly warns the same
  // event can be delivered more than once — a duplicate delivery must not
  // repeat tier updates, subscription changes, or emails.
  const { data: claim, error: claimErr } = await supabase.rpc('claim_stripe_webhook_event', {
    p_event_id: event.id,
    p_event_type: event.type,
  });
  if (claimErr) {
    console.error('stripe-webhook: claim failed', claimErr);
    return json({ error: 'Idempotency claim failed' }, 500);
  }
  if (claim === 'already_succeeded' || claim === 'in_progress') {
    return json({ received: true, deduped: claim });
  }

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
        // §5.5 / P1-B: unknown price ID must not silently downgrade buyer to
        // hustle or invent a tier — resolved from the same config checkout uses.
        const resolved = resolveTierFromPriceId(priceId);
        if (!resolved) {
          console.error(`stripe-webhook: unknown priceId ${priceId} for subscription ${subscriptionId} — no tier assigned`);
          break;
        }
        const { tier } = resolved;
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
        // §5.5 / P1-B: unknown price ID — keep current tier, don't silently downgrade
        const tier = resolveTierFromPriceId(priceId?.['id'] as string)?.tier;
        const periodEnd = data['current_period_end']
          ? new Date((data['current_period_end'] as number) * 1000).toISOString()
          : null;

        const updatePayload: Record<string, unknown> = {
          stripe_subscription_id: subscriptionId,
          subscription_status: status,
          subscription_period_end: periodEnd,
        };
        if (tier) updatePayload.tier = tier;
        else console.error(`stripe-webhook: unknown priceId ${priceId?.['id']} on subscription.updated — tier unchanged`);

        await supabase.from('users').update(updatePayload).eq('stripe_customer_id', customerId);
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

    // Only now — after every required business effect above has actually
    // succeeded — is this event permanently marked complete (P1-B requirement 6).
    await supabase.rpc('complete_stripe_webhook_event', {
      p_event_id: event.id, p_success: true, p_error: null,
    });
    return json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    await supabase.rpc('complete_stripe_webhook_event', {
      p_event_id: event.id, p_success: false, p_error: String((err as Error)?.message ?? err),
    });
    return json({ error: 'Handler error' }, 500);
  }
});
