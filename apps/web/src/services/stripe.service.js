/**
 * Stripe payment service.
 * Redirects to Stripe Checkout and opens the Customer Portal.
 */

import { apiFetch, ENDPOINTS } from './http.js';

/** @typedef {'hustle'|'stack'|'empire'} PaidTier */
/** @typedef {'monthly'} BillingInterval */

/**
 * Create a Stripe Checkout session and redirect the user.
 * @param {PaidTier} tier
 * @param {BillingInterval} interval - only 'monthly' is currently live
 * @returns {Promise<void>}
 */
export async function startCheckout(tier, interval = 'monthly') {
  const data = await apiFetch(`${ENDPOINTS.STRIPE}/create-checkout`, {
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  });

  if (!data.url) throw new Error('No checkout URL returned from Stripe');
  location.href = data.url;
}

/**
 * Open the Stripe Customer Portal (manage subscription, cancel, update payment).
 * @returns {Promise<void>}
 */
export async function openPortal() {
  const data = await apiFetch(`${ENDPOINTS.STRIPE}/portal`, {
    method: 'POST',
  });

  if (!data.url) throw new Error('No portal URL returned from Stripe');
  window.open(data.url, '_blank');
}
