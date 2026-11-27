import 'server-only';
import { createHash } from 'node:crypto';
import { FieldValue, type DocumentData, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import {
  DEFAULT_FEE_BPS,
  deriveJobEscrowPda,
  formatSol,
  getEscrowProgramId,
  getSolanaCluster,
  getTreasuryAddress,
  isValidSolanaAddress,
  jobIdToSeed,
  lamportsToSol,
  MAX_BUDGET_LAMPORTS,
  MAX_TOPUP_LAMPORTS,
  MIN_BUDGET_LAMPORTS,
  MIN_PAYOUT_LAMPORTS,
  MIN_TOPUP_LAMPORTS,
  solToLamports,
  splitLamports,
  verifySolanaMessageSignature,
} from '@/lib/solana';
import {
  fetchOnChainJobEscrow,
  getSolBalanceLamports,
  verifyEscrowTxOnChain,
  verifySolDepositTransaction,
} from '@/lib/solana-server';
import { PublicKey } from '@solana/web3.js';

/**
 * @fileOverview The Agent Garden Web3 job market: Solana smart-contract escrow,
 * custodial SOL wallets, legacy USD balances, and the 15% platform fee.
 *
 * Primary Web3 flow (Solana):
 *  1. Smart-Contract Escrow (`escrow_mode: 'smart_contract'`):
 *     - Poster calls `initialize_job` on the `agent_garden_escrow` Solana program,
 *       locking SOL in a JobEscrow PDA.
 *     - Worker agent claims (`claim_job`), does the work, submits SHA-256 hash (`submit_work`).
 *     - Poster approves (`accept_and_release`), and the smart contract atomically transfers
 *       85% directly to the worker's Solana wallet and 15% to the platform treasury.
 *  2. Wallet / Allowance SOL (`escrow_mode: 'wallet'`):
 *     - Gardener deposits SOL on-chain to the platform treasury (verified via RPC),
 *       or uses existing balance, and sets `spend_allowance_lamports` for autonomous agents.
 *     - Every balance change writes an immutable `ledger_entries` row inside a Firestore transaction.
 */

export const PLATFORM_FEE_BPS = clampInt(Number(process.env.PLATFORM_FEE_BPS ?? DEFAULT_FEE_BPS), 0, 5000); // 15%
export const MIN_BUDGET_CENTS = 100; // $1
export const MAX_BUDGET_CENTS = 1_000_000; // $10,000
export const MIN_PAYOUT_CENTS = 1000; // $10
export const MIN_TOPUP_CENTS = 500; // $5
export const MAX_TOPUP_CENTS = 500_000; // $5,000
export const REVIEW_WINDOW_HOURS = 72;
export const MAX_REVISIONS = 2;
export const MAX_ACTIVE_CLAIMS = 5;
const HOUR = 3_600_000;

export {
  MIN_BUDGET_LAMPORTS,
  MAX_BUDGET_LAMPORTS,
  MIN_PAYOUT_LAMPORTS,
  MIN_TOPUP_LAMPORTS,
  MAX_TOPUP_LAMPORTS,
  formatSol,
  solToLamports,
  lamportsToSol,
  splitLamports,
};

export class MarketError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type Actor =
  | { kind: 'user'; uid: string; isAdmin?: boolean }
  | { kind: 'agent'; agentId: string; ownerId: string; name: string };

export type JobCurrency = 'SOL' | 'USD';
export type EscrowMode = 'smart_contract' | 'wallet';
export type FulfillmentMode = 'any' | 'autonomous_agent' | 'human_operator';
export type JobStatus = 'open' | 'claimed' | 'submitted' | 'completed' | 'cancelled' | 'disputed' | 'refunded';

function clampInt(n: number, min: number, max: number) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
}

export function ownerOf(actor: Actor) {
  return actor.kind === 'user' ? actor.uid : actor.ownerId;
}

export function splitBudget(budgetCents: number) {
  const fee = Math.floor((budgetCents * PLATFORM_FEE_BPS) / 10_000);
  return { fee_cents: fee, payout_cents: budgetCents - fee };
}

export function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function db() {
  return initializeAdmin().db;
}
const walletRef = (ownerId: string) => db().collection('wallets').doc(ownerId);
const treasuryRef = () => db().collection('platform').doc('treasury');
const jobRef = (id: string) => db().collection('jobs').doc(id);

/** Writes one immutable ledger row. */
function ledger(
  tx: Transaction,
  row: {
    owner_id: string;
    type: string;
    currency?: JobCurrency;
    amount_cents?: number;
    amount_lamports?: number;
    job_id?: string | null;
    note?: string | null;
    ref?: string | null;
  },
  id?: string
) {
  const ref = id ? db().collection('ledger_entries').doc(id) : db().collection('ledger_entries').doc();
  tx.set(ref, {
    id: ref.id,
    currency: row.currency ?? 'SOL',
    amount_cents: row.amount_cents ?? 0,
    amount_lamports: row.amount_lamports ?? 0,
    job_id: null,
    note: null,
    ref: null,
    ...row,
    created_at: Date.now(),
  });
}

function inc(n: number) {
  return FieldValue.increment(n);
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

/** What anyone may see about a job. */
export function publicJob(job: DocumentData) {
  const currency: JobCurrency = job.currency === 'USD' ? 'USD' : 'SOL';
  const budgetLamports = Number(job.budget_lamports || 0);
  const payoutLamports = Number(job.payout_lamports || (budgetLamports ? splitLamports(budgetLamports, PLATFORM_FEE_BPS).payout_lamports : 0));
  const budgetCents = Number(job.budget_cents || 0);
  const payoutCents = Number(job.payout_cents ?? splitBudget(budgetCents).payout_cents);
  const isVolunteer = Boolean(job.is_volunteer) || (currency === 'SOL' && budgetLamports === 0 && budgetCents === 0);

  return {
    id: job.id,
    title: job.title,
    description: job.description,
    skills: job.skills || [],
    fulfillment_mode: (job.fulfillment_mode || 'any') as FulfillmentMode,
    is_volunteer: isVolunteer,
    github_issue_url: job.github_issue_url || null,
    github_repo: job.github_repo || null,
    acceptance_criteria: job.acceptance_criteria || null,
    preferred_model: job.preferred_model || null,
    preferred_effort: job.preferred_effort || null,
    currency,
    escrow_mode: (job.escrow_mode || 'wallet') as EscrowMode,
    budget_lamports: budgetLamports,
    payout_lamports: payoutLamports,
    budget_sol: lamportsToSol(budgetLamports),
    worker_gets_sol: lamportsToSol(payoutLamports),
    budget_cents: budgetCents,
    payout_cents: payoutCents,
    budget: isVolunteer ? 'Free / OSS' : currency === 'SOL' ? formatSol(budgetLamports) : dollars(budgetCents),
    worker_gets: isVolunteer ? 'Reputation / OSS' : currency === 'SOL' ? formatSol(payoutLamports) : dollars(payoutCents),
    status: job.status as JobStatus,
    poster_type: job.poster_type,
    poster_name: job.poster_name,
    poster_wallet: job.poster_wallet || null,
    direct_hire_agent_id: job.direct_provider_id || null,
    provider_type: (job.provider_type || 'agent') as 'agent' | 'user',
    provider_id: job.provider_id || null,
    provider_name: job.provider_name || null,
    worker_wallet: job.worker_wallet || null,
    escrow_pda: job.escrow_pda || null,
    escrow_tx: job.escrow_tx || null,
    settlement_tx: job.settlement_tx || null,
    solana_cluster: job.solana_cluster || getSolanaCluster(),
    deadline_hours: job.deadline_hours,
    revisions: job.revisions || 0,
    created_at: job.created_at,
    claimed_at: job.claimed_at || null,
    claim_expires_at: job.claim_expires_at || null,
    submitted_at: job.submitted_at || null,
    auto_accept_at: job.auto_accept_at || null,
    completed_at: job.completed_at || null,
  };
}

/** Extra detail for the poster, the worker and admins. */
export function partyJob(job: DocumentData) {
  return {
    ...publicJob(job),
    deliverable: job.deliverable || null,
    payload_hash: job.payload_hash || null,
    claim_tx: job.claim_tx || null,
    submit_tx: job.submit_tx || null,
    refund_tx: job.refund_tx || null,
    feedback: job.feedback || [],
    dispute_reason: job.dispute_reason || null,
    resolution: job.resolution || null,
    fee_cents: job.fee_cents ?? null,
    fee_lamports: job.fee_lamports ?? null,
  };
}

function isPoster(actor: Actor, job: DocumentData) {
  if (actor.kind === 'agent') return job.poster_type === 'agent' && job.poster_id === actor.agentId;
  return job.poster_owner_id === actor.uid;
}

function isWorker(actor: Actor, job: DocumentData) {
  if (actor.kind === 'agent') return job.provider_id === actor.agentId;
  return !!job.provider_owner_id && job.provider_owner_id === actor.uid;
}

export function canSeePrivate(actor: Actor | null, job: DocumentData) {
  if (!actor) return false;
  if (actor.kind === 'user' && actor.isAdmin) return true;
  return isPoster(actor, job) || isWorker(actor, job);
}

// ---------------------------------------------------------------------------
// Timers & Settlement
// ---------------------------------------------------------------------------

function settle(
  tx: Transaction,
  ref: DocumentReference,
  job: DocumentData,
  how: 'accepted' | 'auto_accepted' | 'admin_paid',
  settlementTx?: string | null
) {
  const now = Date.now();
  const currency: JobCurrency = job.currency === 'USD' ? 'USD' : 'SOL';
  const isSmartContract = job.escrow_mode === 'smart_contract';

  if (currency === 'SOL') {
    const budgetLamports = Number(job.budget_lamports || 0);
    const { fee_lamports, payout_lamports } = splitLamports(budgetLamports, PLATFORM_FEE_BPS);

    if (budgetLamports > 0) {
      if (!isSmartContract) {
        // Wallet-mode SOL: debit poster's held_lamports, credit worker's balance_lamports.
        tx.set(
          walletRef(job.poster_owner_id),
          { owner_id: job.poster_owner_id, held_lamports: inc(-budgetLamports), spent_lamports: inc(budgetLamports), updated_at: now },
          { merge: true }
        );
        tx.set(
          walletRef(job.provider_owner_id),
          { owner_id: job.provider_owner_id, balance_lamports: inc(payout_lamports), earned_lamports: inc(payout_lamports), updated_at: now },
          { merge: true }
        );
        tx.set(treasuryRef(), { fees_lamports: inc(fee_lamports), gross_volume_lamports: inc(budgetLamports), jobs_completed: inc(1), updated_at: now }, { merge: true });
      } else {
        // Smart-contract mode: funds already moved directly on Solana! Record analytics only.
        tx.set(
          walletRef(job.poster_owner_id),
          { owner_id: job.poster_owner_id, spent_lamports: inc(budgetLamports), updated_at: now },
          { merge: true }
        );
        tx.set(
          walletRef(job.provider_owner_id),
          { owner_id: job.provider_owner_id, earned_lamports: inc(payout_lamports), updated_at: now },
          { merge: true }
        );
        tx.set(treasuryRef(), { fees_lamports: inc(fee_lamports), gross_volume_lamports: inc(budgetLamports), jobs_completed: inc(1), updated_at: now }, { merge: true });
      }
    } else {
      tx.set(treasuryRef(), { jobs_completed: inc(1), updated_at: now }, { merge: true });
    }

    if (job.provider_type === 'user') {
      tx.set(
        db().collection('users').doc(job.provider_owner_id),
        { karma: inc(10), jobs_completed: inc(1), earned_lamports: inc(payout_lamports) },
        { merge: true }
      );
    } else if (job.provider_id) {
      tx.set(
        db().collection('agents').doc(job.provider_id),
        { verified_task_count: inc(1), review_count: inc(1), reputation: inc(10), jobs_completed: inc(1), earned_lamports: inc(payout_lamports) },
        { merge: true }
      );
    }

    if (budgetLamports > 0) {
      const modeLabel = isSmartContract ? 'on-chain smart contract' : 'escrow';
      ledger(tx, {
        owner_id: job.poster_owner_id,
        type: 'job_paid',
        currency: 'SOL',
        amount_lamports: 0,
        job_id: job.id,
        ref: settlementTx || null,
        note: `Paid ${formatSol(budgetLamports)} via ${modeLabel} for "${job.title}"`,
      });
      ledger(tx, {
        owner_id: job.provider_owner_id,
        type: 'job_earned',
        currency: 'SOL',
        amount_lamports: payout_lamports,
        job_id: job.id,
        ref: settlementTx || null,
        note: `${job.provider_name} earned ${formatSol(payout_lamports)} for "${job.title}"`,
      });
      ledger(tx, {
        owner_id: 'platform',
        type: 'platform_fee',
        currency: 'SOL',
        amount_lamports: fee_lamports,
        job_id: job.id,
        ref: settlementTx || null,
        note: `${PLATFORM_FEE_BPS / 100}% of ${formatSol(budgetLamports)}`,
      });
    }

    const patch = {
      status: 'completed',
      fee_lamports,
      payout_lamports,
      settlement_tx: settlementTx || job.settlement_tx || null,
      completed_at: now,
      completed_by: how,
      updated_at: now,
    };
    tx.update(ref, patch);
    return { ...job, ...patch };
  }

  // Legacy USD path
  const { fee_cents, payout_cents } = splitBudget(job.budget_cents);
  tx.set(walletRef(job.poster_owner_id), { owner_id: job.poster_owner_id, held_cents: inc(-job.budget_cents), spent_cents: inc(job.budget_cents), updated_at: now }, { merge: true });
  tx.set(walletRef(job.provider_owner_id), { owner_id: job.provider_owner_id, balance_cents: inc(payout_cents), earned_cents: inc(payout_cents), updated_at: now }, { merge: true });
  tx.set(treasuryRef(), { fees_cents: inc(fee_cents), gross_volume_cents: inc(job.budget_cents), jobs_completed: inc(1), updated_at: now }, { merge: true });
  tx.set(
    db().collection('agents').doc(job.provider_id),
    { verified_task_count: inc(1), review_count: inc(1), reputation: inc(10), jobs_completed: inc(1), earned_cents: inc(payout_cents) },
    { merge: true }
  );

  ledger(tx, { owner_id: job.poster_owner_id, type: 'job_paid', currency: 'USD', amount_cents: 0, job_id: job.id, note: `Paid ${dollars(job.budget_cents)} from escrow for "${job.title}"` });
  ledger(tx, { owner_id: job.provider_owner_id, type: 'job_earned', currency: 'USD', amount_cents: payout_cents, job_id: job.id, note: `${job.provider_name} earned ${dollars(payout_cents)} for "${job.title}"` });
  ledger(tx, { owner_id: 'platform', type: 'platform_fee', currency: 'USD', amount_cents: fee_cents, job_id: job.id, note: `${PLATFORM_FEE_BPS / 100}% of ${dollars(job.budget_cents)}` });

  tx.update(ref, { status: 'completed', fee_cents, payout_cents, completed_at: now, completed_by: how, updated_at: now });
  return { ...job, status: 'completed', fee_cents, payout_cents, completed_at: now, completed_by: how };
}

function refund(tx: Transaction, ref: DocumentReference, job: DocumentData, status: 'cancelled' | 'refunded', note: string, refundTx?: string | null) {
  const now = Date.now();
  const currency: JobCurrency = job.currency === 'USD' ? 'USD' : 'SOL';
  const isSmartContract = job.escrow_mode === 'smart_contract';

  if (currency === 'SOL') {
    const budgetLamports = Number(job.budget_lamports || 0);
    if (!isSmartContract && budgetLamports > 0) {
      tx.set(walletRef(job.poster_owner_id), { owner_id: job.poster_owner_id, held_lamports: inc(-budgetLamports), balance_lamports: inc(budgetLamports), updated_at: now }, { merge: true });
      if (job.poster_type === 'agent') {
        tx.set(db().collection('agents').doc(job.poster_id), { spend_allowance_lamports: inc(budgetLamports) }, { merge: true });
      }
    }
    if (budgetLamports > 0) {
      ledger(tx, { owner_id: job.poster_owner_id, type: 'escrow_refund', currency: 'SOL', amount_lamports: isSmartContract ? 0 : budgetLamports, job_id: job.id, ref: refundTx || null, note });
    }
    tx.update(ref, { status, refund_tx: refundTx || null, updated_at: now });
    return { ...job, status, refund_tx: refundTx || null };
  }

  tx.set(walletRef(job.poster_owner_id), { owner_id: job.poster_owner_id, held_cents: inc(-job.budget_cents), balance_cents: inc(job.budget_cents), updated_at: now }, { merge: true });
  if (job.poster_type === 'agent') {
    tx.set(db().collection('agents').doc(job.poster_id), { spend_allowance_cents: inc(job.budget_cents) }, { merge: true });
  }
  ledger(tx, { owner_id: job.poster_owner_id, type: 'escrow_refund', currency: 'USD', amount_cents: job.budget_cents, job_id: job.id, note });
  tx.update(ref, { status, updated_at: now });
  return { ...job, status };
}

function reopen(tx: Transaction, ref: DocumentReference, job: DocumentData, reason: string) {
  const now = Date.now();
  const patch = {
    status: 'open',
    provider_id: job.direct_provider_id || null,
    provider_owner_id: null,
    provider_name: null,
    worker_wallet: null,
    claimed_at: null,
    claim_expires_at: null,
    feedback: FieldValue.arrayUnion({ at: now, from: 'system', text: reason }),
    updated_at: now,
  };
  tx.update(ref, patch);
  return { ...job, ...patch, feedback: [...(job.feedback || []), { at: now, from: 'system', text: reason }] };
}

function applyTimers(tx: Transaction, ref: DocumentReference, job: DocumentData): DocumentData {
  const now = Date.now();
  if (job.status === 'claimed' && job.claim_expires_at && job.claim_expires_at < now) {
    return reopen(tx, ref, job, `Claim by ${job.provider_name} expired without a submission.`);
  }
  // Note: smart_contract jobs require on-chain accept_and_release crank so off-chain timer only auto-settles wallet-mode jobs.
  if (job.status === 'submitted' && job.escrow_mode !== 'smart_contract' && job.auto_accept_at && job.auto_accept_at < now) {
    return settle(tx, ref, job, 'auto_accepted');
  }
  return job;
}

export async function sweepTimers(max = 25) {
  const now = Date.now();
  const [expired, overdue] = await Promise.all([
    db().collection('jobs').where('status', '==', 'claimed').where('claim_expires_at', '<', now).limit(max).get(),
    db().collection('jobs').where('status', '==', 'submitted').where('auto_accept_at', '<', now).limit(max).get(),
  ]);
  let changed = 0;
  for (const d of [...expired.docs, ...overdue.docs]) {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(d.ref);
      if (!snap.exists) return;
      const before = snap.data()!;
      const after = applyTimers(tx, d.ref, before);
      if (after.status !== before.status) changed++;
    });
  }
  return { changed };
}

async function sweepQuietly() {
  try {
    await sweepTimers(10);
  } catch (e) {
    console.warn('Market sweep skipped:', e);
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type PostJobInput = {
  job_id?: string;
  title: string;
  description: string;
  /** Web3 primary: SOL amount (e.g. 0.25) or integer lamports. */
  budget_sol?: number;
  budget_lamports?: number;
  /** Legacy USD cents (only used when currency === 'USD' or neither budget_sol/budget_lamports is given). */
  budget_cents?: number;
  currency?: JobCurrency;
  skills?: string[];
  deadline_hours?: number;
  direct_agent_id?: string | null;
  /** For on-chain smart contract escrow: tx signature + poster wallet pubkey. */
  escrow_tx?: string;
  poster_wallet?: string;
  /** Human-Operated AI Dev Marketplace & GitHub Bounties fields (Issue #1). */
  fulfillment_mode?: FulfillmentMode;
  is_volunteer?: boolean;
  github_issue_url?: string | null;
  acceptance_criteria?: string | null;
  preferred_model?: string | null;
  preferred_effort?: string | null;
};

function cleanSkills(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];
  const out = new Set<string>();
  for (const s of skills) {
    const t = String(s || '').trim().toLowerCase().slice(0, 40);
    if (t) out.add(t);
    if (out.size >= 10) break;
  }
  return [...out];
}

/** Allocates a fresh job ID before an on-chain `initialize_job` transaction is signed. */
export function allocateJobId() {
  return db().collection('jobs').doc().id;
}

export async function postJob(actor: Actor, input: PostJobInput) {
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  const deadline = input.deadline_hours == null ? 24 : Number(input.deadline_hours);
  const skills = cleanSkills(input.skills);
  if (title.length < 5 || title.length > 120) throw new MarketError('title must be 5–120 characters.');
  if (description.length < 20 || description.length > 8000) throw new MarketError('description must be 20–8000 characters. Say exactly what "done" looks like.');
  if (!Number.isInteger(deadline) || deadline < 1 || deadline > 720) throw new MarketError('deadline_hours must be 1–720.');

  const fulfillmentMode: FulfillmentMode =
    input.fulfillment_mode === 'human_operator' || input.fulfillment_mode === 'autonomous_agent'
      ? input.fulfillment_mode
      : 'any';
  const isVolunteer = Boolean(input.is_volunteer);
  const githubIssueUrl = String(input.github_issue_url || '').trim() || null;
  let githubRepo: string | null = null;
  if (githubIssueUrl) {
    const ghMatch = githubIssueUrl.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/issues\/\d+/i);
    if (!ghMatch) throw new MarketError('github_issue_url must be a valid https://github.com/owner/repo/issues/N URL.');
    githubRepo = ghMatch[1];
  }
  const acceptanceCriteria = String(input.acceptance_criteria || '').trim().slice(0, 4000) || null;
  const preferredModel = String(input.preferred_model || '').trim().slice(0, 80) || null;
  const preferredEffort = String(input.preferred_effort || '').trim().slice(0, 20) || null;

  const hasSolBudget = input.budget_lamports != null || input.budget_sol != null;
  const currency: JobCurrency = input.currency === 'USD' && !hasSolBudget && !isVolunteer ? 'USD' : 'SOL';

  let budgetLamports = 0;
  let budgetCents = 0;
  if (isVolunteer) {
    budgetLamports = 0;
    budgetCents = 0;
  } else if (currency === 'SOL') {
    budgetLamports = input.budget_lamports != null ? Math.round(Number(input.budget_lamports)) : solToLamports(Number(input.budget_sol || 0));
    if (!Number.isInteger(budgetLamports) || budgetLamports < MIN_BUDGET_LAMPORTS || budgetLamports > MAX_BUDGET_LAMPORTS) {
      throw new MarketError(`budget must be between ${formatSol(MIN_BUDGET_LAMPORTS)} and ${formatSol(MAX_BUDGET_LAMPORTS)}.`);
    }
  } else {
    budgetCents = Number(input.budget_cents);
    if (!Number.isInteger(budgetCents) || budgetCents < MIN_BUDGET_CENTS || budgetCents > MAX_BUDGET_CENTS) {
      throw new MarketError(`budget_cents must be a whole number from ${MIN_BUDGET_CENTS} (${dollars(MIN_BUDGET_CENTS)}) to ${MAX_BUDGET_CENTS}.`);
    }
  }

  const owner = ownerOf(actor);
  const directId = input.direct_agent_id ? String(input.direct_agent_id) : null;
  let directName: string | null = null;
  let directWallet: string | null = null;
  if (directId) {
    const d = await db().collection('agents').doc(directId).get();
    if (!d.exists || d.data()?.status !== 'active') throw new MarketError('That agent is not available for hire.', 404);
    if (d.data()!.owner_id === owner) throw new MarketError('You cannot hire your own agent through the market.');
    directName = d.data()!.name;
    directWallet = d.data()!.solana_address || d.data()!.payment_address || null;
  }

  let posterName = 'A gardener';
  let posterWallet = input.poster_wallet && isValidSolanaAddress(input.poster_wallet) ? input.poster_wallet.trim() : null;
  if (actor.kind === 'agent') {
    posterName = actor.name;
    if (!posterWallet) {
      const aSnap = await db().collection('agents').doc(actor.agentId).get();
      posterWallet = aSnap.data()?.solana_address || aSnap.data()?.payment_address || null;
    }
  } else {
    const u = await db().collection('users').doc(actor.uid).get();
    posterName = u.data()?.displayName || posterName;
    if (!posterWallet) posterWallet = u.data()?.solana_address || null;
  }

  // Generate or validate pre-allocated job ID (needed for PDA seed in smart-contract mode).
  const customId = input.job_id ? String(input.job_id).trim() : '';
  if (customId && !/^[a-zA-Z0-9_-]{8,64}$/.test(customId)) {
    throw new MarketError('job_id must be 8–64 alphanumeric characters.');
  }
  const ref = customId ? db().collection('jobs').doc(customId) : db().collection('jobs').doc();

  // Verify on-chain smart contract escrow if `escrow_tx` is provided.
  let escrowMode: EscrowMode = 'wallet';
  let escrowPda: string | null = null;
  let escrowTx: string | null = null;

  if (input.escrow_tx) {
    if (currency !== 'SOL') throw new MarketError('Smart contract escrow requires SOL currency.');
    if (!posterWallet || !isValidSolanaAddress(posterWallet)) {
      throw new MarketError('poster_wallet (valid Solana address) is required for smart contract escrow.');
    }
    const seed = await jobIdToSeed(ref.id);
    const [expectedPda] = deriveJobEscrowPda(new PublicKey(posterWallet), seed, getEscrowProgramId());
    escrowPda = expectedPda.toBase58();

    try {
      await verifyEscrowTxOnChain({ signature: input.escrow_tx, expectedAccount: escrowPda });
    } catch (err) {
      throw new MarketError(err instanceof Error ? err.message : 'Could not verify Solana escrow transaction.', 402);
    }

    const onChain = await fetchOnChainJobEscrow(posterWallet, ref.id);
    if (onChain?.state) {
      if (onChain.state.amount_lamports < budgetLamports) {
        throw new MarketError(`On-chain escrow holds ${formatSol(onChain.state.amount_lamports)}, expected ${formatSol(budgetLamports)}.`, 402);
      }
      if (onChain.state.status !== 'open') {
        throw new MarketError(`On-chain escrow is in status "${onChain.state.status}", not "open".`, 409);
      }
    }

    escrowMode = 'smart_contract';
    escrowTx = input.escrow_tx.trim();
  }

  const { payout_lamports } = splitLamports(budgetLamports, PLATFORM_FEE_BPS);
  const { payout_cents } = splitBudget(budgetCents);

  await db().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) throw new MarketError('A job with this ID already exists.', 409);

    if (escrowMode === 'wallet' && !isVolunteer) {
      const wSnap = await tx.get(walletRef(owner));
      let agentSnap = null;
      if (actor.kind === 'agent') agentSnap = await tx.get(db().collection('agents').doc(actor.agentId));

      if (currency === 'SOL') {
        const balance = Number(wSnap.data()?.balance_lamports || 0);
        if (balance < budgetLamports) {
          throw new MarketError(
            actor.kind === 'agent'
              ? `Your owner's SOL wallet has ${formatSol(balance)}; this job needs ${formatSol(budgetLamports)}. Or fund directly on-chain using smart contract escrow.`
              : `Your SOL wallet has ${formatSol(balance)}; this job needs ${formatSol(budgetLamports)}. Deposit SOL or sign an on-chain smart contract escrow.`,
            402
          );
        }
        if (actor.kind === 'agent') {
          const allowance = Number(agentSnap!.data()?.spend_allowance_lamports || 0);
          if (allowance < budgetLamports) {
            throw new MarketError(
              `Your gardener lets you spend ${formatSol(allowance)}; this job needs ${formatSol(budgetLamports)}. They can raise your SOL allowance in the dashboard.`,
              403
            );
          }
          tx.update(agentSnap!.ref, { spend_allowance_lamports: inc(-budgetLamports) });
        }
        tx.set(walletRef(owner), { owner_id: owner, balance_lamports: inc(-budgetLamports), held_lamports: inc(budgetLamports), updated_at: Date.now() }, { merge: true });
        ledger(tx, { owner_id: owner, type: 'escrow_hold', currency: 'SOL', amount_lamports: -budgetLamports, job_id: ref.id, note: `Held ${formatSol(budgetLamports)} for "${title}"` });
      } else {
        const balance = Number(wSnap.data()?.balance_cents || 0);
        if (balance < budgetCents) {
          throw new MarketError(`Your USD balance has ${dollars(balance)}; this job needs ${dollars(budgetCents)}.`, 402);
        }
        if (actor.kind === 'agent') {
          const allowance = Number(agentSnap!.data()?.spend_allowance_cents || 0);
          if (allowance < budgetCents) {
            throw new MarketError(`Your gardener lets you spend ${dollars(allowance)}; this job needs ${dollars(budgetCents)}.`, 403);
          }
          tx.update(agentSnap!.ref, { spend_allowance_cents: inc(-budgetCents) });
        }
        tx.set(walletRef(owner), { owner_id: owner, balance_cents: inc(-budgetCents), held_cents: inc(budgetCents), updated_at: Date.now() }, { merge: true });
        ledger(tx, { owner_id: owner, type: 'escrow_hold', currency: 'USD', amount_cents: -budgetCents, job_id: ref.id, note: `Held for "${title}"` });
      }
    } else {
      ledger(tx, {
        owner_id: owner,
        type: 'smart_contract_escrow',
        currency: 'SOL',
        amount_lamports: 0,
        job_id: ref.id,
        ref: escrowTx,
        note: `Locked ${formatSol(budgetLamports)} in Solana smart contract PDA ${escrowPda}`,
      });
    }

    tx.set(ref, {
      id: ref.id,
      title,
      description,
      skills,
      fulfillment_mode: fulfillmentMode,
      is_volunteer: isVolunteer,
      github_issue_url: githubIssueUrl,
      github_repo: githubRepo,
      acceptance_criteria: acceptanceCriteria,
      preferred_model: preferredModel,
      preferred_effort: preferredEffort,
      currency,
      escrow_mode: escrowMode,
      budget_lamports: budgetLamports,
      payout_lamports: payout_lamports,
      budget_cents: budgetCents,
      payout_cents: payout_cents,
      deadline_hours: deadline,
      status: 'open',
      poster_type: actor.kind,
      poster_id: actor.kind === 'agent' ? actor.agentId : actor.uid,
      poster_owner_id: owner,
      poster_name: posterName,
      poster_wallet: posterWallet,
      direct_provider_id: directId,
      direct_provider_name: directName,
      direct_provider_wallet: directWallet,
      provider_type: 'agent',
      provider_id: directId,
      provider_owner_id: null,
      provider_name: null,
      worker_wallet: null,
      escrow_pda: escrowPda,
      escrow_tx: escrowTx,
      solana_cluster: getSolanaCluster(),
      revisions: 0,
      feedback: [],
      deliverable: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  });

  const snap = await ref.get();
  return publicJob(snap.data()!);
}

async function withJob<T>(jobId: string, fn: (tx: Transaction, ref: DocumentReference, job: DocumentData) => Promise<T> | T) {
  if (!jobId) throw new MarketError('job_id is required.');
  const ref = jobRef(String(jobId));
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MarketError('Job not found.', 404);
    return fn(tx, ref, applyTimers(tx, ref, snap.data()!));
  });
}

export async function claimJob(actor: Actor, jobId: string, opts: { worker_wallet?: string; claim_tx?: string } = {}) {
  const workerId = actor.kind === 'agent' ? actor.agentId : actor.uid;
  const workerOwnerId = ownerOf(actor);
  const active = await db().collection('jobs').where('provider_id', '==', workerId).where('status', '==', 'claimed').count().get();
  if (active.data().count >= MAX_ACTIVE_CLAIMS) throw new MarketError(`You already have ${MAX_ACTIVE_CLAIMS} claimed jobs. Submit or release one first.`, 429);

  if (opts.worker_wallet && !isValidSolanaAddress(opts.worker_wallet)) {
    throw new MarketError('worker_wallet must be a valid Solana public key.');
  }

  let workerName = 'A developer';
  let workerWallet = opts.worker_wallet?.trim() || null;

  if (actor.kind === 'agent') {
    workerName = actor.name;
    const agentSnap = await db().collection('agents').doc(actor.agentId).get();
    const agentData = agentSnap.data() || {};
    workerWallet = workerWallet || agentData.solana_address || agentData.payment_address || null;
  } else {
    const userSnap = await db().collection('users').doc(actor.uid).get();
    const userData = userSnap.data() || {};
    workerName = userData.displayName || userData.email || 'A developer';
    workerWallet = workerWallet || userData.solana_address || null;
  }

  if (!workerWallet) {
    const ownerWalletSnap = await walletRef(workerOwnerId).get();
    workerWallet = ownerWalletSnap.data()?.solana_address || null;
  }

  return withJob(jobId, async (tx, ref, job) => {
    if (job.status !== 'open') throw new MarketError(`Job is ${job.status}, not open.`, 409);
    const mode: FulfillmentMode = job.fulfillment_mode || 'any';
    if (mode === 'human_operator' && actor.kind === 'agent') {
      throw new MarketError('This task is for a human developer using AI coding tools.', 403);
    }
    if (mode === 'autonomous_agent' && actor.kind === 'user') {
      throw new MarketError('This task is reserved for autonomous AI agents. Use an agent API key to claim it.', 403);
    }
    if (job.direct_provider_id && job.direct_provider_id !== workerId) throw new MarketError('This job is a direct hire for another agent.', 403);
    if (job.poster_owner_id === workerOwnerId) throw new MarketError('You cannot claim your own job.', 403);
    if (job.escrow_mode === 'smart_contract' && !workerWallet) {
      throw new MarketError('This job uses Solana smart contract escrow. Link a Solana wallet address or pass worker_wallet to claim.');
    }

    if (opts.claim_tx && job.escrow_mode === 'smart_contract' && job.escrow_pda) {
      await verifyEscrowTxOnChain({ signature: opts.claim_tx, expectedAccount: job.escrow_pda });
    }

    const now = Date.now();
    const patch = {
      status: 'claimed',
      provider_type: actor.kind,
      provider_id: workerId,
      provider_owner_id: workerOwnerId,
      provider_name: workerName,
      worker_wallet: workerWallet,
      claim_tx: opts.claim_tx || null,
      claimed_at: now,
      claim_expires_at: now + job.deadline_hours * HOUR,
      updated_at: now,
    };
    tx.update(ref, patch);
    return partyJob({ ...job, ...patch });
  });
}

export async function releaseJob(actor: Actor, jobId: string) {
  return withJob(jobId, (tx, ref, job) => {
    if (!isWorker(actor, job) || job.status !== 'claimed') throw new MarketError('You can only release a job you have claimed and not yet submitted.', 409);
    return publicJob(reopen(tx, ref, job, `${job.provider_name} released the job.`));
  });
}

export async function submitWork(
  actor: Actor,
  jobId: string,
  input: { text?: string; url?: string; github_pr_url?: string; ai_tools_used?: string; submit_tx?: string }
) {
  const text = String(input.text || '').trim();
  const prUrl = String(input.github_pr_url || '').trim();
  const url = String(input.url || prUrl || '').trim();
  const aiToolsUsed = String(input.ai_tools_used || '').trim().slice(0, 160) || null;
  if (!text && !url) throw new MarketError('Send the finished work as text, a PR/deliverable url, or both.');
  if (text.length > 50_000) throw new MarketError('text is limited to 50,000 characters. Put larger work behind a url.', 413);
  if (url && !/^https:\/\/[^\s]{3,2000}$/i.test(url)) throw new MarketError('url must be an https:// link.');
  if (prUrl && !/^https:\/\/github\.com\/[^\s]{3,2000}$/i.test(prUrl)) throw new MarketError('github_pr_url must be a valid https://github.com/... link.');

  const workerId = actor.kind === 'agent' ? actor.agentId : actor.uid;

  return withJob(jobId, async (tx, ref, job) => {
    if (job.provider_id !== workerId && !(actor.kind === 'user' && job.provider_owner_id === actor.uid && job.provider_type === 'user')) {
      throw new MarketError('Only the worker that claimed this job can submit work.', 403);
    }
    if (job.status !== 'claimed') throw new MarketError(job.status === 'open' ? 'Your claim expired; claim the job again.' : `Job is ${job.status}.`, 409);

    if (input.submit_tx && job.escrow_mode === 'smart_contract' && job.escrow_pda) {
      await verifyEscrowTxOnChain({ signature: input.submit_tx, expectedAccount: job.escrow_pda });
    }

    const now = Date.now();
    const payload_hash = createHash('sha256').update(`${text}\n${url}`).digest('hex');
    const patch = {
      status: 'submitted',
      deliverable: {
        text: text || null,
        url: url || null,
        github_pr_url: prUrl || null,
        ai_tools_used: aiToolsUsed,
        submitted_at: now,
      },
      payload_hash,
      submit_tx: input.submit_tx || null,
      submitted_at: now,
      auto_accept_at: now + REVIEW_WINDOW_HOURS * HOUR,
      updated_at: now,
    };
    tx.update(ref, patch);
    return partyJob({ ...job, ...patch });
  });
}

export async function reviewWork(
  actor: Actor,
  jobId: string,
  decision: string,
  feedback?: string,
  opts: { tx_signature?: string } = {}
) {
  const note = String(feedback || '').trim().slice(0, 2000);
  if (!['accept', 'revise', 'dispute'].includes(decision)) throw new MarketError('decision must be accept, revise or dispute.');

  return withJob(jobId, async (tx, ref, job) => {
    if (!isPoster(actor, job)) throw new MarketError('Only the job poster can review the work.', 403);
    if (job.status === 'completed') return partyJob(job);
    if (job.status !== 'submitted') throw new MarketError(`Job is ${job.status}; there is no submission to review.`, 409);
    const now = Date.now();

    if (decision === 'accept') {
      if (job.escrow_mode === 'smart_contract') {
        if (!opts.tx_signature) {
          throw new MarketError('On-chain smart contract jobs require `tx_signature` from signing `accept_and_release` on Solana.');
        }
        await verifyEscrowTxOnChain({ signature: opts.tx_signature, expectedAccount: job.escrow_pda });
      }
      return partyJob(settle(tx, ref, job, 'accepted', opts.tx_signature));
    }

    if (decision === 'revise') {
      if ((job.revisions || 0) >= MAX_REVISIONS) throw new MarketError(`This job already had ${MAX_REVISIONS} revisions. Accept it or open a dispute.`, 409);
      if (!note) throw new MarketError('Say what needs to change in feedback.');
      if (opts.tx_signature && job.escrow_mode === 'smart_contract' && job.escrow_pda) {
        await verifyEscrowTxOnChain({ signature: opts.tx_signature, expectedAccount: job.escrow_pda });
      }
      const patch = {
        status: 'claimed',
        revisions: inc(1),
        feedback: FieldValue.arrayUnion({ at: now, from: 'poster', text: note }),
        claim_expires_at: now + job.deadline_hours * HOUR,
        auto_accept_at: null,
        updated_at: now,
      };
      tx.update(ref, patch);
      return partyJob({ ...job, ...patch, revisions: (job.revisions || 0) + 1, feedback: [...(job.feedback || []), { at: now, from: 'poster', text: note }] });
    }

    if (!note) throw new MarketError('Explain the problem in feedback so an admin can resolve the dispute.');
    if (opts.tx_signature && job.escrow_mode === 'smart_contract' && job.escrow_pda) {
      await verifyEscrowTxOnChain({ signature: opts.tx_signature, expectedAccount: job.escrow_pda });
    }
    tx.update(ref, { status: 'disputed', dispute_reason: note, dispute_tx: opts.tx_signature || null, disputed_at: now, auto_accept_at: null, updated_at: now });
    return partyJob({ ...job, status: 'disputed', dispute_reason: note });
  });
}

export async function cancelJob(actor: Actor, jobId: string, opts: { refund_tx?: string } = {}) {
  return withJob(jobId, async (tx, ref, job) => {
    if (!isPoster(actor, job)) throw new MarketError('Only the poster can cancel a job.', 403);
    if (job.status !== 'open') throw new MarketError('Only open (unclaimed) jobs can be cancelled.', 409);
    if (job.escrow_mode === 'smart_contract') {
      if (!opts.refund_tx) {
        throw new MarketError('Smart contract jobs require `refund_tx` from calling `cancel_job` on Solana to reclaim escrowed SOL.');
      }
      await verifyEscrowTxOnChain({ signature: opts.refund_tx, expectedAccount: job.escrow_pda });
    }
    const label = job.currency === 'USD' ? dollars(job.budget_cents) : formatSol(job.budget_lamports || 0);
    return publicJob(refund(tx, ref, job, 'cancelled', `Cancelled "${job.title}"; ${label} returned`, opts.refund_tx));
  });
}

export async function resolveDispute(jobId: string, outcome: 'pay_worker' | 'refund_poster', note: string, adminUid: string, txSignature?: string) {
  return withJob(jobId, async (tx, ref, job) => {
    if (job.status !== 'disputed') throw new MarketError('Job is not disputed.', 409);
    if (txSignature && job.escrow_mode === 'smart_contract' && job.escrow_pda) {
      await verifyEscrowTxOnChain({ signature: txSignature, expectedAccount: job.escrow_pda });
    }
    tx.update(ref, { resolution: { outcome, note: note.slice(0, 2000), by: adminUid, at: Date.now(), tx_signature: txSignature || null } });
    if (outcome === 'pay_worker') return partyJob(settle(tx, ref, job, 'admin_paid', txSignature));
    const label = job.currency === 'USD' ? dollars(job.budget_cents) : formatSol(job.budget_lamports || 0);
    return partyJob(refund(tx, ref, job, 'refunded', `Dispute on "${job.title}" resolved in your favour; ${label} returned`, txSignature));
  });
}

export async function getJob(actor: Actor | null, jobId: string) {
  if (!jobId) throw new MarketError('job_id is required.');
  const job = await withJob(jobId, (_tx, _ref, j) => j);
  return canSeePrivate(actor, job) ? partyJob(job) : publicJob(job);
}

export async function listOpenJobs(opts: { skill?: string; q?: string; min_budget_cents?: number; min_budget_lamports?: number; limit?: number } = {}) {
  await sweepQuietly();
  const snap = await db().collection('jobs').where('status', '==', 'open').orderBy('created_at', 'desc').limit(200).get();
  const skill = String(opts.skill || '').trim().toLowerCase();
  const q = String(opts.q || '').trim().toLowerCase();
  const minCents = Number(opts.min_budget_cents || 0);
  const minLamports = Number(opts.min_budget_lamports || 0);
  const limit = clampInt(Number(opts.limit || 50), 1, 100);
  const activeCluster = getSolanaCluster();
  return snap.docs
    .map((d) => d.data())
    .filter((j) => !j.solana_cluster || j.solana_cluster === activeCluster)
    .filter((j) => !skill || (j.skills || []).some((s: string) => s.includes(skill)))
    .filter((j) => !q || `${j.title} ${j.description} ${(j.skills || []).join(' ')}`.toLowerCase().includes(q))
    .filter((j) => (minCents <= 0 || (j.budget_cents || 0) >= minCents))
    .filter((j) => (minLamports <= 0 || (j.budget_lamports || 0) >= minLamports))
    .slice(0, limit)
    .map(publicJob);
}

export async function myJobs(actor: Actor, role: 'posted' | 'working') {
  await sweepQuietly();
  const col = db().collection('jobs');
  let q;
  if (role === 'posted') q = actor.kind === 'agent' ? col.where('poster_id', '==', actor.agentId) : col.where('poster_owner_id', '==', actor.uid);
  else q = actor.kind === 'agent' ? col.where('provider_id', '==', actor.agentId) : col.where('provider_owner_id', '==', actor.uid);
  const snap = await q.limit(200).get();
  return snap.docs
    .map((d) => d.data())
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))
    .map(partyJob);
}

// ---------------------------------------------------------------------------
// Wallets, SOL deposits, payouts, Solana linking
// ---------------------------------------------------------------------------

function walletView(data: DocumentData | undefined) {
  const w = data || {};
  const n = (k: string) => Number(w[k] || 0);
  return {
    solana_address: (w.solana_address as string) || null,
    balance_lamports: n('balance_lamports'),
    held_lamports: n('held_lamports'),
    pending_payout_lamports: n('pending_payout_lamports'),
    earned_lamports: n('earned_lamports'),
    spent_lamports: n('spent_lamports'),
    withdrawn_lamports: n('withdrawn_lamports'),
    topped_up_lamports: n('topped_up_lamports'),
    // Legacy USD fields
    balance_cents: n('balance_cents'),
    held_cents: n('held_cents'),
    pending_payout_cents: n('pending_payout_cents'),
    earned_cents: n('earned_cents'),
    spent_cents: n('spent_cents'),
    withdrawn_cents: n('withdrawn_cents'),
    topped_up_cents: n('topped_up_cents'),
  };
}

export async function getWallet(ownerId: string, entries = 30) {
  await sweepQuietly();
  const [w, rows] = await Promise.all([
    walletRef(ownerId).get(),
    db().collection('ledger_entries').where('owner_id', '==', ownerId).orderBy('created_at', 'desc').limit(entries).get(),
  ]);
  const view = walletView(w.data());
  const onchain_lamports = view.solana_address ? await getSolBalanceLamports(view.solana_address) : 0;
  return { ...view, onchain_lamports, entries: rows.docs.map((d) => d.data()) };
}

/** What an agent may see about its own Web3 wallet & earnings. */
export async function getAgentWallet(actor: Extract<Actor, { kind: 'agent' }>) {
  await sweepQuietly();
  const a = (await db().collection('agents').doc(actor.agentId).get()).data() || {};
  const solanaAddress = (a.solana_address as string) || (a.payment_address as string) || null;
  const onchain_lamports = solanaAddress ? await getSolBalanceLamports(solanaAddress) : 0;

  return {
    agent_id: actor.agentId,
    solana_address: solanaAddress,
    solana_cluster: getSolanaCluster(),
    onchain_lamports,
    onchain_sol: formatSol(onchain_lamports),
    earned_lamports: Number(a.earned_lamports || 0),
    earned_sol: formatSol(Number(a.earned_lamports || 0)),
    spend_allowance_lamports: Number(a.spend_allowance_lamports || 0),
    spend_allowance_sol: formatSol(Number(a.spend_allowance_lamports || 0)),
    // Legacy USD
    earned_cents: Number(a.earned_cents || 0),
    earned: dollars(Number(a.earned_cents || 0)),
    spend_allowance_cents: Number(a.spend_allowance_cents || 0),
    jobs_completed: Number(a.jobs_completed || 0),
    reputation: Number(a.reputation || 0),
    note: 'Smart-contract payouts settle directly to your solana_address. Wallet-mode jobs draw from your gardener’s SOL spend allowance.',
  };
}

/** Links a verified Solana wallet to a gardener's profile & wallet via Ed25519 signature. */
export async function linkUserSolanaWallet(uid: string, solanaAddress: string, message: string, signatureBase58: string) {
  if (!isValidSolanaAddress(solanaAddress)) throw new MarketError('Invalid Solana public key.');
  if (!message.includes(uid)) throw new MarketError('Signature challenge must include your user ID.');
  const ok = verifySolanaMessageSignature(solanaAddress, message, signatureBase58);
  if (!ok) throw new MarketError('Solana wallet signature verification failed.', 401);

  const now = Date.now();
  await Promise.all([
    db().collection('users').doc(uid).set({ solana_address: solanaAddress.trim(), updated_at: now }, { merge: true }),
    walletRef(uid).set({ owner_id: uid, solana_address: solanaAddress.trim(), updated_at: now }, { merge: true }),
  ]);
  return { success: true, solana_address: solanaAddress.trim() };
}

/** Verifies and credits an on-chain SOL deposit sent to the platform treasury. */
export async function creditSolDeposit(ownerId: string, txSignature: string) {
  const treasury = getTreasuryAddress();
  if (!isValidSolanaAddress(treasury)) {
    throw new MarketError('Platform Solana treasury address is not configured yet. Set NEXT_PUBLIC_SOLANA_TREASURY.', 503);
  }
  const verified = await verifySolDepositTransaction({
    signature: txSignature,
    expectedRecipient: treasury,
    minLamports: 1_000_000, // min 0.001 SOL
  });

  const lamports = verified.received_lamports;
  const entryId = `sol_topup_${verified.signature}`;
  return db().runTransaction(async (tx) => {
    const existing = await tx.get(db().collection('ledger_entries').doc(entryId));
    if (existing.exists) return { duplicate: true, lamports };
    tx.set(
      walletRef(ownerId),
      { owner_id: ownerId, balance_lamports: inc(lamports), topped_up_lamports: inc(lamports), updated_at: Date.now() },
      { merge: true }
    );
    tx.set(treasuryRef(), { topups_lamports: inc(lamports), updated_at: Date.now() }, { merge: true });
    ledger(
      tx,
      {
        owner_id: ownerId,
        type: 'sol_topup',
        currency: 'SOL',
        amount_lamports: lamports,
        ref: verified.signature,
        note: `Deposited ${formatSol(lamports)} on Solana (${getSolanaCluster()})`,
      },
      entryId
    );
    return { duplicate: false, lamports, signature: verified.signature };
  });
}

/** Credits a paid Stripe Checkout session exactly once (legacy fallback). */
export async function creditTopup(ownerId: string, cents: number, sessionId: string) {
  if (!ownerId || !Number.isInteger(cents) || cents <= 0) throw new MarketError('Bad top-up.');
  const entryId = `topup_${sessionId}`;
  return db().runTransaction(async (tx) => {
    const existing = await tx.get(db().collection('ledger_entries').doc(entryId));
    if (existing.exists) return { duplicate: true };
    tx.set(walletRef(ownerId), { owner_id: ownerId, balance_cents: inc(cents), topped_up_cents: inc(cents), updated_at: Date.now() }, { merge: true });
    tx.set(treasuryRef(), { topups_cents: inc(cents), updated_at: Date.now() }, { merge: true });
    ledger(tx, { owner_id: ownerId, type: 'topup', currency: 'USD', amount_cents: cents, ref: sessionId, note: `Added ${dollars(cents)} by card` }, entryId);
    return { duplicate: false };
  });
}

/** Admin: grant promotional SOL (or legacy USD) credit. */
export async function grantSolCredit(ownerId: string, lamports: number, note: string, adminUid: string) {
  if (!Number.isInteger(lamports) || lamports === 0 || Math.abs(lamports) > MAX_TOPUP_LAMPORTS) {
    throw new MarketError('Amount must be a non-zero whole number of lamports.');
  }
  const user = await db().collection('users').doc(ownerId).get();
  if (!user.exists) throw new MarketError('No gardener with that id.', 404);
  return db().runTransaction(async (tx) => {
    const w = await tx.get(walletRef(ownerId));
    if (lamports < 0 && Number(w.data()?.balance_lamports || 0) < -lamports) throw new MarketError('That would make the SOL balance negative.');
    tx.set(walletRef(ownerId), { owner_id: ownerId, balance_lamports: inc(lamports), granted_lamports: inc(lamports), updated_at: Date.now() }, { merge: true });
    tx.set(treasuryRef(), { grants_lamports: inc(lamports), updated_at: Date.now() }, { merge: true });
    ledger(tx, { owner_id: ownerId, type: 'sol_grant', currency: 'SOL', amount_lamports: lamports, ref: adminUid, note: note.slice(0, 200) || 'SOL credit from Agent Garden' });
    return { success: true };
  });
}

export async function grantCredit(ownerId: string, cents: number, note: string, adminUid: string) {
  if (!Number.isInteger(cents) || cents === 0 || Math.abs(cents) > MAX_TOPUP_CENTS) throw new MarketError('Amount must be a non-zero whole number of cents.');
  const user = await db().collection('users').doc(ownerId).get();
  if (!user.exists) throw new MarketError('No gardener with that id.', 404);
  return db().runTransaction(async (tx) => {
    const w = await tx.get(walletRef(ownerId));
    if (cents < 0 && Number(w.data()?.balance_cents || 0) < -cents) throw new MarketError('That would make the balance negative.');
    tx.set(walletRef(ownerId), { owner_id: ownerId, balance_cents: inc(cents), granted_cents: inc(cents), updated_at: Date.now() }, { merge: true });
    tx.set(treasuryRef(), { grants_cents: inc(cents), updated_at: Date.now() }, { merge: true });
    ledger(tx, { owner_id: ownerId, type: 'grant', currency: 'USD', amount_cents: cents, ref: adminUid, note: note.slice(0, 200) || 'Credit from Agent Garden' });
    return { success: true };
  });
}

export async function requestSolPayout(uid: string, lamports: number, solanaAddress: string) {
  const addr = String(solanaAddress || '').trim();
  if (!Number.isInteger(lamports) || lamports < MIN_PAYOUT_LAMPORTS) {
    throw new MarketError(`The minimum SOL withdrawal is ${formatSol(MIN_PAYOUT_LAMPORTS)}.`);
  }
  if (!isValidSolanaAddress(addr)) throw new MarketError('Enter a valid Solana wallet address.');
  const ref = db().collection('payout_requests').doc();
  await db().runTransaction(async (tx) => {
    const w = await tx.get(walletRef(uid));
    const balance = Number(w.data()?.balance_lamports || 0);
    if (balance < lamports) throw new MarketError(`You have ${formatSol(balance)} available.`);
    tx.set(walletRef(uid), { owner_id: uid, balance_lamports: inc(-lamports), pending_payout_lamports: inc(lamports), updated_at: Date.now() }, { merge: true });
    ledger(tx, { owner_id: uid, type: 'sol_payout_requested', currency: 'SOL', amount_lamports: -lamports, ref: ref.id, note: `SOL withdrawal of ${formatSol(lamports)} to ${addr}` });
    tx.set(ref, { id: ref.id, owner_id: uid, currency: 'SOL', amount_lamports: lamports, solana_address: addr, method: `SOL: ${addr}`, status: 'pending', created_at: Date.now() });
  });
  return { success: true, payout_id: ref.id };
}

export async function requestPayout(uid: string, cents: number, method: string) {
  const how = String(method || '').trim().slice(0, 300);
  if (!Number.isInteger(cents) || cents < MIN_PAYOUT_CENTS) throw new MarketError(`The minimum withdrawal is ${dollars(MIN_PAYOUT_CENTS)}.`);
  if (how.length < 5) throw new MarketError('Say how you want to be paid.');
  const ref = db().collection('payout_requests').doc();
  await db().runTransaction(async (tx) => {
    const w = await tx.get(walletRef(uid));
    const balance = Number(w.data()?.balance_cents || 0);
    if (balance < cents) throw new MarketError(`You have ${dollars(balance)} available.`);
    tx.set(walletRef(uid), { owner_id: uid, balance_cents: inc(-cents), pending_payout_cents: inc(cents), updated_at: Date.now() }, { merge: true });
    ledger(tx, { owner_id: uid, type: 'payout_requested', currency: 'USD', amount_cents: -cents, ref: ref.id, note: `Withdrawal of ${dollars(cents)} requested` });
    tx.set(ref, { id: ref.id, owner_id: uid, currency: 'USD', amount_cents: cents, method: how, status: 'pending', created_at: Date.now() });
  });
  return { success: true, payout_id: ref.id };
}

export async function settlePayout(payoutId: string, outcome: 'paid' | 'rejected', note: string, adminUid: string) {
  const ref = db().collection('payout_requests').doc(payoutId);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new MarketError('Payout not found.', 404);
    const p = snap.data()!;
    if (p.status !== 'pending') throw new MarketError(`Payout is already ${p.status}.`, 409);
    const now = Date.now();

    if (p.currency === 'SOL') {
      const lamports = Number(p.amount_lamports || 0);
      if (outcome === 'paid') {
        tx.set(walletRef(p.owner_id), { pending_payout_lamports: inc(-lamports), withdrawn_lamports: inc(lamports), updated_at: now }, { merge: true });
        tx.set(treasuryRef(), { payouts_lamports: inc(lamports), updated_at: now }, { merge: true });
        ledger(tx, { owner_id: p.owner_id, type: 'sol_payout_sent', currency: 'SOL', amount_lamports: 0, ref: payoutId, note: `Sent ${formatSol(lamports)} to ${p.solana_address}${note ? `: ${note.slice(0, 200)}` : ''}` });
      } else {
        tx.set(walletRef(p.owner_id), { pending_payout_lamports: inc(-lamports), balance_lamports: inc(lamports), updated_at: now }, { merge: true });
        ledger(tx, { owner_id: p.owner_id, type: 'sol_payout_rejected', currency: 'SOL', amount_lamports: lamports, ref: payoutId, note: `SOL withdrawal returned${note ? `: ${note.slice(0, 200)}` : ''}` });
      }
    } else {
      if (outcome === 'paid') {
        tx.set(walletRef(p.owner_id), { pending_payout_cents: inc(-p.amount_cents), withdrawn_cents: inc(p.amount_cents), updated_at: now }, { merge: true });
        tx.set(treasuryRef(), { payouts_cents: inc(p.amount_cents), updated_at: now }, { merge: true });
        ledger(tx, { owner_id: p.owner_id, type: 'payout_sent', currency: 'USD', amount_cents: 0, ref: payoutId, note: `Sent ${dollars(p.amount_cents)}${note ? `: ${note.slice(0, 200)}` : ''}` });
      } else {
        tx.set(walletRef(p.owner_id), { pending_payout_cents: inc(-p.amount_cents), balance_cents: inc(p.amount_cents), updated_at: now }, { merge: true });
        ledger(tx, { owner_id: p.owner_id, type: 'payout_rejected', currency: 'USD', amount_cents: p.amount_cents, ref: payoutId, note: `Withdrawal returned to balance${note ? `: ${note.slice(0, 200)}` : ''}` });
      }
    }

    tx.update(ref, { status: outcome, note: note.slice(0, 500) || null, settled_by: adminUid, settled_at: now });
    return { success: true };
  });
}

/** Owner sets how much SOL (lamports) an agent may put into jobs it posts. */
export async function setAgentSolAllowance(uid: string, agentId: string, lamports: number) {
  if (!Number.isInteger(lamports) || lamports < 0 || lamports > MAX_BUDGET_LAMPORTS * 10) {
    throw new MarketError('Allowance must be a whole number of lamports, 0 or more.');
  }
  const ref = db().collection('agents').doc(agentId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.owner_id !== uid) throw new MarketError('You can only set allowances for your own agents.', 403);
  await ref.update({ spend_allowance_lamports: lamports });
  return { success: true };
}

export async function setAgentAllowance(uid: string, agentId: string, cents: number) {
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_BUDGET_CENTS * 10) throw new MarketError('Allowance must be a whole number of cents, 0 or more.');
  const ref = db().collection('agents').doc(agentId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.owner_id !== uid) throw new MarketError('You can only set allowances for your own agents.', 403);
  await ref.update({ spend_allowance_cents: cents });
  return { success: true };
}

export async function setAgentSolanaAddress(uid: string, agentId: string, solanaAddress: string) {
  if (!isValidSolanaAddress(solanaAddress)) throw new MarketError('Invalid Solana public key.');
  const ref = db().collection('agents').doc(agentId);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.owner_id !== uid) throw new MarketError('You can only update your own agents.', 403);
  await ref.update({ solana_address: solanaAddress.trim(), payment_address: solanaAddress.trim(), supports_x402: true, updated_at: Date.now() });
  return { success: true };
}

export async function marketStats() {
  const [t, open, disputes, payouts] = await Promise.all([
    treasuryRef().get(),
    db().collection('jobs').where('status', '==', 'open').count().get(),
    db().collection('jobs').where('status', '==', 'disputed').limit(50).get(),
    db().collection('payout_requests').where('status', '==', 'pending').limit(50).get(),
  ]);
  const td = t.data() || {};
  return {
    fee_bps: PLATFORM_FEE_BPS,
    solana_cluster: getSolanaCluster(),
    solana_program_id: getEscrowProgramId().toBase58(),
    solana_treasury: getTreasuryAddress(),
    fees_lamports: Number(td.fees_lamports || 0),
    gross_volume_lamports: Number(td.gross_volume_lamports || 0),
    topups_lamports: Number(td.topups_lamports || 0),
    grants_lamports: Number(td.grants_lamports || 0),
    payouts_lamports: Number(td.payouts_lamports || 0),
    fees_cents: Number(td.fees_cents || 0),
    gross_volume_cents: Number(td.gross_volume_cents || 0),
    jobs_completed: Number(td.jobs_completed || 0),
    topups_cents: Number(td.topups_cents || 0),
    grants_cents: Number(td.grants_cents || 0),
    payouts_cents: Number(td.payouts_cents || 0),
    open_jobs: open.data().count,
    disputes: disputes.docs.map((d) => partyJob(d.data())),
    payouts: payouts.docs.map((d) => d.data()),
  };
}
