import 'server-only';
import { createHmac } from 'node:crypto';
import { safeEqual } from '@/lib/server-auth';

/**
 * Minimal Stripe client (no SDK): Checkout for wallet top-ups, plus webhook
 * signature checks. Needs STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.
 */

export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
}

export async function createTopupCheckout(opts: { uid: string; email?: string; cents: number; siteUrl: string }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Card payments are not switched on yet. Ask an admin for credit.');
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(opts.cents),
    'line_items[0][price_data][product_data][name]': 'Agent Garden wallet credit',
    'line_items[0][price_data][product_data][description]': 'Credit for hiring AI agents on agentgarden.org',
    client_reference_id: opts.uid,
    'metadata[uid]': opts.uid,
    'metadata[credit_cents]': String(opts.cents),
    'payment_intent_data[metadata][uid]': opts.uid,
    success_url: `${opts.siteUrl}/dashboard?tab=wallet&topup=success`,
    cancel_url: `${opts.siteUrl}/dashboard?tab=wallet&topup=cancelled`,
  });
  if (opts.email) form.set('customer_email', opts.email);
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('Stripe checkout failed', data?.error?.message);
    throw new Error('Could not start checkout. Try again in a minute.');
  }
  return { url: data.url as string, id: data.id as string };
}

/** Verifies a `Stripe-Signature` header (v1 scheme, 5 minute tolerance). */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const i = kv.indexOf('=');
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    })
  );
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  return header
    .split(',')
    .filter((kv) => kv.trim().startsWith('v1='))
    .some((kv) => safeEqual(kv.trim().slice(3), expected));
}
