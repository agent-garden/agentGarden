import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';

/**
 * Cost protection for public search.
 *
 * 1. Per-visitor rate limit (best effort, keyed on the client IP).
 * 2. Hard daily budgets for the paid AI steps (query embeddings and the LLM
 *    re-rank). When a budget runs out, search keeps working in its free
 *    fallback mode instead of spending more. These budgets hold no matter how
 *    many IPs a caller uses.
 *
 * Counters live in `usage_limits/*`, which the Firestore rules close to clients.
 */

const PER_MINUTE = Number(process.env.SEARCH_PER_MINUTE_LIMIT || 20);
const DAILY = {
  embed: Number(process.env.SEARCH_DAILY_EMBED_LIMIT || 3000),
  rerank: Number(process.env.SEARCH_DAILY_RERANK_LIMIT || 1000),
  audit: Number(process.env.DAILY_AUDIT_LIMIT || 500),
};

export class SearchRateLimitError extends Error {
  status = 429;
  constructor(msg = 'Too many requests. Please wait a minute and try again.') {
    super(msg);
  }
}

async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for') || '';
  const ips = forwarded.split(',').map((s) => s.trim()).filter(Boolean);
  // Behind Google Cloud Load Balancer / Envoy, the proxy-verified client IP is appended at the tail.
  const ip = (ips.length >= 2 ? ips[ips.length - 2] : ips[ips.length - 1]) || h.get('x-real-ip') || 'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/** Generic per-IP per-minute rate limiter backed by `usage_limits/*`. */
export async function enforceIpRateLimit(bucket: string, limitPerMinute: number): Promise<void> {
  const { db } = initializeAdmin();
  const minute = Math.floor(Date.now() / 60_000);
  const ref = db.collection('usage_limits').doc(`rl-${bucket}-${await clientKey()}-${minute}`);
  const allowed = await db.runTransaction(async (tx) => {
    const count = Number((await tx.get(ref)).data()?.count || 0);
    if (count >= limitPerMinute) return false;
    tx.set(ref, { count: count + 1, expires_at: (minute + 2) * 60_000 }, { merge: true });
    return true;
  });
  if (!allowed) throw new SearchRateLimitError('Rate limit exceeded. Please wait a minute and retry.');
}

/** Throws SearchRateLimitError when this visitor has searched too often this minute. */
export async function enforceSearchRateLimit(): Promise<void> {
  return enforceIpRateLimit('search', PER_MINUTE);
}

/** Reserves one unit of today's budget for a paid AI step. Returns false when the budget is used up. */
export async function takeAiBudget(kind: keyof typeof DAILY): Promise<boolean> {
  const { db } = initializeAdmin();
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection('usage_limits').doc(`search-budget-${day}`);
  return db.runTransaction(async (tx) => {
    const used = Number((await tx.get(ref)).data()?.[kind] || 0);
    if (used >= DAILY[kind]) return false;
    tx.set(ref, { [kind]: FieldValue.increment(1), day }, { merge: true });
    return true;
  });
}
