import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/server-auth';
import { optionalAgentActor } from '@/lib/agent-actor';
import { allocateJobId, MarketError } from '@/lib/market';
import { solToLamports } from '@/lib/solana';
import { buildSerializedSolanaTx, fetchOnChainJobEscrow, type BuildTxAction } from '@/lib/solana-server';
import { initializeAdmin } from '@/firebase/admin';

const VALID_ACTIONS: BuildTxAction[] = [
  'deposit_treasury',
  'initialize_job',
  'claim_job',
  'release_claim',
  'submit_work',
  'request_revision',
  'accept_and_release',
  'cancel_job',
  'dispute_job',
];

/**
 * GET /api/v1/solana/tx?job_id=...&poster=...
 * Reads live on-chain JobEscrow PDA state from Solana RPC.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('job_id') || '';
    if (!jobId) throw new MarketError('job_id is required.');

    let poster = url.searchParams.get('poster') || '';
    if (!poster) {
      const snap = await initializeAdmin().db.collection('jobs').doc(jobId).get();
      if (!snap.exists) throw new MarketError('Job not found.', 404);
      poster = snap.data()?.poster_wallet || '';
      if (!poster) throw new MarketError('Job does not have an associated Solana poster wallet.', 400);
    }

    const escrow = await fetchOnChainJobEscrow(poster, jobId);
    if (!escrow) {
      return NextResponse.json({ found: false, job_id: jobId, poster });
    }
    return NextResponse.json({ found: true, job_id: jobId, ...escrow });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * POST /api/v1/solana/tx
 * Builds an unsigned Solana transaction (base64) for any smart-contract escrow action
 * or treasury SOL deposit. Agents sign with their Solana keypair and broadcast to RPC.
 */
export async function POST(request: Request) {
  try {
    const actor = await optionalAgentActor(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '') as BuildTxAction;
    if (!VALID_ACTIONS.includes(action)) {
      throw new MarketError(`Unknown action. Use one of: ${VALID_ACTIONS.join(', ')}`);
    }

    let feePayer = String(body.fee_payer || body.wallet || '').trim();
    if (!feePayer && actor) {
      const aSnap = await initializeAdmin().db.collection('agents').doc(actor.agentId).get();
      feePayer = aSnap.data()?.solana_address || aSnap.data()?.payment_address || '';
    }
    if (!feePayer) {
      throw new MarketError('fee_payer (your Solana public key) is required.');
    }

    let jobId = body.job_id ? String(body.job_id).trim() : '';
    if (action === 'initialize_job' && !jobId) {
      jobId = allocateJobId();
    }

    let poster = body.poster ? String(body.poster).trim() : undefined;
    let worker = body.worker ? String(body.worker).trim() : undefined;
    let deliverableHashHex = body.deliverable_hash ? String(body.deliverable_hash).trim() : undefined;

    if (jobId && action !== 'initialize_job' && action !== 'deposit_treasury') {
      const snap = await initializeAdmin().db.collection('jobs').doc(jobId).get();
      if (snap.exists) {
        const j = snap.data()!;
        poster = poster || j.poster_wallet || undefined;
        worker = worker || j.worker_wallet || undefined;
        deliverableHashHex = deliverableHashHex || j.payload_hash || undefined;
      }
    }

    const amountLamports =
      body.amount_lamports != null
        ? Math.round(Number(body.amount_lamports))
        : body.amount_sol != null
        ? solToLamports(Number(body.amount_sol))
        : undefined;

    const deadlineSecs =
      body.deadline_secs != null
        ? Math.round(Number(body.deadline_secs))
        : body.deadline_hours != null
        ? Math.round(Number(body.deadline_hours) * 3600)
        : undefined;

    const built = await buildSerializedSolanaTx({
      action,
      feePayer,
      jobId,
      poster: poster || feePayer,
      worker: worker || feePayer,
      amountLamports,
      deadlineSecs,
      directWorker: body.direct_worker || null,
      deliverableHashHex,
      posterMustSign: body.poster_must_sign,
    });

    return NextResponse.json({
      success: true,
      action,
      job_id: jobId || null,
      ...built,
    });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
