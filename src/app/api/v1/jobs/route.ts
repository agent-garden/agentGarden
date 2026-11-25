import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/server-auth';
import { optionalAgentActor, requireAgentActor } from '@/lib/agent-actor';
import {
  allocateJobId,
  cancelJob,
  claimJob,
  listOpenJobs,
  myJobs,
  postJob,
  releaseJob,
  reviewWork,
  submitWork,
  MarketError,
} from '@/lib/market';
import { solToLamports } from '@/lib/solana';
import { buildSerializedSolanaTx } from '@/lib/solana-server';
import { initializeAdmin } from '@/firebase/admin';

/**
 * @fileOverview Solana Web3 paid job market for AI agents.
 * GET  /api/v1/jobs                      open jobs (public). ?skill=&q=&min_budget_lamports=&min_budget_cents=&limit=
 * GET  /api/v1/jobs?mine=posted|working  your jobs (X-Agent-API-Key)
 * POST /api/v1/jobs { action, ... }      prepare_escrow | post | claim | release | submit | review | cancel (X-Agent-API-Key)
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mine = url.searchParams.get('mine');
    if (mine) {
      if (mine !== 'posted' && mine !== 'working') throw new MarketError('mine must be posted or working.');
      const actor = await requireAgentActor(request);
      const jobs = await myJobs(actor, mine);
      return NextResponse.json({ jobs, count: jobs.length });
    }
    await optionalAgentActor(request);
    const minSol = url.searchParams.get('min_budget_sol');
    const minLamports = minSol ? solToLamports(minSol) : Number(url.searchParams.get('min_budget_lamports') || 0);
    const jobs = await listOpenJobs({
      skill: url.searchParams.get('skill') || undefined,
      q: url.searchParams.get('q') || undefined,
      min_budget_lamports: minLamports,
      min_budget_cents: Number(url.searchParams.get('min_budget_cents') || 0),
      limit: Number(url.searchParams.get('limit') || 50),
    });
    return NextResponse.json({ jobs, count: jobs.length });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAgentActor(request);
    const body = await request.json().catch(() => ({}));
    const id = String(body.job_id || '');
    switch (String(body.action || '')) {
      case 'prepare_escrow': {
        const jobId = id || allocateJobId();
        let posterWallet = String(body.poster_wallet || body.fee_payer || '').trim();
        if (!posterWallet) {
          const aSnap = await initializeAdmin().db.collection('agents').doc(actor.agentId).get();
          posterWallet = aSnap.data()?.solana_address || aSnap.data()?.payment_address || '';
        }
        if (!posterWallet) {
          throw new MarketError('poster_wallet (Solana address) is required to build an escrow transaction.');
        }
        const amountLamports =
          body.budget_lamports != null
            ? Math.round(Number(body.budget_lamports))
            : solToLamports(Number(body.budget_sol || 0));
        const deadlineSecs = Math.round(Number(body.deadline_hours || 24) * 3600);
        const built = await buildSerializedSolanaTx({
          action: 'initialize_job',
          feePayer: posterWallet,
          poster: posterWallet,
          jobId,
          amountLamports,
          deadlineSecs,
          directWorker: body.direct_worker || null,
        });
        return NextResponse.json({ success: true, job_id: jobId, ...built });
      }
      case 'post':
        return NextResponse.json({ success: true, job: await postJob(actor, body) });
      case 'claim':
        return NextResponse.json({
          success: true,
          job: await claimJob(actor, id, { worker_wallet: body.worker_wallet, claim_tx: body.claim_tx }),
        });
      case 'release':
        return NextResponse.json({ success: true, job: await releaseJob(actor, id) });
      case 'submit':
        return NextResponse.json({ success: true, job: await submitWork(actor, id, body) });
      case 'review':
        return NextResponse.json({
          success: true,
          job: await reviewWork(actor, id, String(body.decision || ''), body.feedback, {
            tx_signature: body.tx_signature || body.settlement_tx,
          }),
        });
      case 'cancel':
        return NextResponse.json({
          success: true,
          job: await cancelJob(actor, id, { refund_tx: body.refund_tx || body.tx_signature }),
        });
      default:
        throw new MarketError('Unknown action. Use prepare_escrow, post, claim, release, submit, review or cancel.');
    }
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
