'use server';

import { initializeAdmin } from '@/firebase/admin';
import { requireAdmin, requireUser, isAdminUid } from '@/lib/server-auth';
import {
  allocateJobId,
  cancelJob,
  claimJob,
  creditSolDeposit,
  getJob,
  getWallet,
  grantCredit,
  grantSolCredit,
  linkUserSolanaWallet,
  marketStats,
  myJobs,
  postJob,
  releaseJob,
  requestPayout,
  requestSolPayout,
  resolveDispute,
  reviewWork,
  setAgentAllowance,
  setAgentSolAllowance,
  setAgentSolanaAddress,
  settlePayout,
  submitWork,
  MIN_TOPUP_CENTS,
  MAX_TOPUP_CENTS,
  PLATFORM_FEE_BPS,
  dollars,
  type Actor,
  type PostJobInput,
} from '@/lib/market';
import {
  getEscrowProgramId,
  getSolanaCluster,
  getTreasuryAddress,
  isSmartContractConfigured,
  MIN_TOPUP_LAMPORTS,
} from '@/lib/solana';
import { createTopupCheckout, stripeConfigured } from '@/lib/stripe';

/**
 * @fileOverview Human-facing server actions for the Web3 Solana job market.
 * Errors are returned as { error } (not thrown) so their messages reach the UI cleanly.
 */

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    const message = e instanceof Error && typeof status === 'number' ? e.message : 'Something went wrong. Please try again.';
    if (typeof status !== 'number') console.error(e);
    return { ok: false, error: message };
  }
}

async function userActor(idToken: string): Promise<Actor> {
  const d = await requireUser(idToken);
  return { kind: 'user', uid: d.uid, isAdmin: await isAdminUid(d.uid, d) };
}

export async function marketConfig() {
  return {
    feeBps: PLATFORM_FEE_BPS,
    cardPayments: stripeConfigured(),
    minTopupCents: MIN_TOPUP_CENTS,
    minTopupLamports: MIN_TOPUP_LAMPORTS,
    solanaCluster: getSolanaCluster(),
    solanaProgramId: getEscrowProgramId().toBase58(),
    solanaTreasury: getTreasuryAddress(),
    smartContractConfigured: isSmartContractConfigured(),
  };
}

export async function getMyMarket(idToken: string) {
  return run(async () => {
    const actor = (await userActor(idToken)) as Extract<Actor, { kind: 'user' }>;
    const { db } = initializeAdmin();
    const [wallet, posted, working, agents] = await Promise.all([
      getWallet(actor.uid),
      myJobs(actor, 'posted'),
      myJobs(actor, 'working'),
      db.collection('agents').where('owner_id', '==', actor.uid).get(),
    ]);
    return {
      wallet,
      posted,
      working,
      agents: agents.docs.map((d) => ({
        id: d.id,
        name: d.data().name as string,
        solana_address: (d.data().solana_address as string) || (d.data().payment_address as string) || null,
        spend_allowance_lamports: Number(d.data().spend_allowance_lamports || 0),
        earned_lamports: Number(d.data().earned_lamports || 0),
        spend_allowance_cents: Number(d.data().spend_allowance_cents || 0),
        earned_cents: Number(d.data().earned_cents || 0),
        jobs_completed: Number(d.data().jobs_completed || 0),
      })),
      feeBps: PLATFORM_FEE_BPS,
      cardPayments: stripeConfigured(),
      solanaCluster: getSolanaCluster(),
      solanaProgramId: getEscrowProgramId().toBase58(),
      solanaTreasury: getTreasuryAddress(),
      smartContractConfigured: isSmartContractConfigured(),
    };
  });
}

export async function allocateJobIdAsUser(idToken: string) {
  return run(async () => {
    await requireUser(idToken);
    return { job_id: allocateJobId() };
  });
}

export async function postJobAsUser(idToken: string, input: PostJobInput) {
  return run(async () => postJob(await userActor(idToken), input));
}

export async function claimJobAsUser(idToken: string, jobId: string, workerWallet?: string) {
  return run(async () => claimJob(await userActor(idToken), jobId, { worker_wallet: workerWallet }));
}

export async function releaseJobAsUser(idToken: string, jobId: string) {
  return run(async () => releaseJob(await userActor(idToken), jobId));
}

export async function submitWorkAsUser(
  idToken: string,
  jobId: string,
  input: { text?: string; url?: string; github_pr_url?: string; ai_tools_used?: string }
) {
  return run(async () => submitWork(await userActor(idToken), jobId, input));
}

export async function reviewJobAsUser(
  idToken: string,
  jobId: string,
  decision: 'accept' | 'revise' | 'dispute',
  feedback?: string,
  txSignature?: string
) {
  return run(async () => reviewWork(await userActor(idToken), jobId, decision, feedback, { tx_signature: txSignature }));
}

export async function cancelJobAsUser(idToken: string, jobId: string, refundTx?: string) {
  return run(async () => cancelJob(await userActor(idToken), jobId, { refund_tx: refundTx }));
}

export async function getJobAsUser(idToken: string | null, jobId: string) {
  return run(async () => getJob(idToken ? await userActor(idToken) : null, jobId));
}

export async function linkSolanaWallet(idToken: string, solanaAddress: string, message: string, signatureBase58: string) {
  return run(async () => linkUserSolanaWallet((await requireUser(idToken)).uid, solanaAddress, message, signatureBase58));
}

export async function confirmSolDeposit(idToken: string, txSignature: string) {
  return run(async () => creditSolDeposit((await requireUser(idToken)).uid, txSignature));
}

export async function withdrawSol(idToken: string, lamports: number, solanaAddress: string) {
  return run(async () => requestSolPayout((await requireUser(idToken)).uid, lamports, solanaAddress));
}

export async function setSolAllowance(idToken: string, agentId: string, lamports: number) {
  return run(async () => setAgentSolAllowance((await requireUser(idToken)).uid, agentId, lamports));
}

export async function updateAgentSolanaWallet(idToken: string, agentId: string, solanaAddress: string) {
  return run(async () => setAgentSolanaAddress((await requireUser(idToken)).uid, agentId, solanaAddress));
}

export async function setAllowance(idToken: string, agentId: string, cents: number) {
  return run(async () => setAgentAllowance((await requireUser(idToken)).uid, agentId, cents));
}

export async function withdraw(idToken: string, cents: number, method: string) {
  return run(async () => requestPayout((await requireUser(idToken)).uid, cents, method));
}

export async function startTopup(idToken: string, cents: number) {
  return run(async () => {
    const d = await requireUser(idToken);
    if (!Number.isInteger(cents) || cents < MIN_TOPUP_CENTS || cents > MAX_TOPUP_CENTS) {
      throw Object.assign(new Error(`Add between ${dollars(MIN_TOPUP_CENTS)} and ${dollars(MAX_TOPUP_CENTS)}.`), { status: 400 });
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://agentgarden.org';
    try {
      return await createTopupCheckout({ uid: d.uid, email: d.email, cents, siteUrl });
    } catch (e) {
      throw Object.assign(e instanceof Error ? e : new Error('Checkout failed.'), { status: 503 });
    }
  });
}

// ---------- Admin ----------

export async function adminMarket(idToken: string) {
  return run(async () => {
    await requireAdmin(idToken);
    return marketStats();
  });
}

export async function adminResolveDispute(
  idToken: string,
  jobId: string,
  outcome: 'pay_worker' | 'refund_poster',
  note: string,
  txSignature?: string
) {
  return run(async () => resolveDispute(jobId, outcome, note || '', (await requireAdmin(idToken)).uid, txSignature));
}

export async function adminSettlePayout(idToken: string, payoutId: string, outcome: 'paid' | 'rejected', note: string) {
  return run(async () => settlePayout(payoutId, outcome, note || '', (await requireAdmin(idToken)).uid));
}

export async function adminGrantSolCredit(idToken: string, who: string, lamports: number, note: string) {
  return run(async () => {
    const admin = await requireAdmin(idToken);
    const { auth } = initializeAdmin();
    let uid = who.trim();
    if (uid.includes('@')) {
      try {
        uid = (await auth.getUserByEmail(uid)).uid;
      } catch {
        throw Object.assign(new Error('No account with that email.'), { status: 404 });
      }
    }
    return grantSolCredit(uid, lamports, note || '', admin.uid);
  });
}

/** Grant legacy USD credit by gardener email (or uid). */
export async function adminGrantCredit(idToken: string, who: string, cents: number, note: string) {
  return run(async () => {
    const admin = await requireAdmin(idToken);
    const { auth } = initializeAdmin();
    let uid = who.trim();
    if (uid.includes('@')) {
      try {
        uid = (await auth.getUserByEmail(uid)).uid;
      } catch {
        throw Object.assign(new Error('No account with that email.'), { status: 404 });
      }
    }
    return grantCredit(uid, cents, note || '', admin.uid);
  });
}
