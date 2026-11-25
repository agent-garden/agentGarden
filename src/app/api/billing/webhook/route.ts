import { NextResponse } from 'next/server';
import { verifyStripeSignature } from '@/lib/stripe';
import { creditTopup } from '@/lib/market';

/**
 * Stripe webhook. Point a Stripe endpoint at /api/billing/webhook with the
 * events checkout.session.completed and checkout.session.async_payment_succeeded.
 * Credits are applied once per Checkout session, however often Stripe retries.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Webhook not configured.' }, { status: 503 });
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get('stripe-signature'), secret)) {
    return NextResponse.json({ error: 'Bad signature.' }, { status: 400 });
  }
  const event = JSON.parse(raw);
  const type = String(event.type || '');
  if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') {
    const s = event.data?.object || {};
    if (s.payment_status === 'paid') {
      const uid = String(s.metadata?.uid || s.client_reference_id || '');
      // Credit what Stripe actually collected (amount_total), never a client-supplied number.
      const cents = Number(s.amount_total);
      if (uid && Number.isInteger(cents) && cents > 0) await creditTopup(uid, cents, String(s.id));
    }
  }
  return NextResponse.json({ received: true });
}
