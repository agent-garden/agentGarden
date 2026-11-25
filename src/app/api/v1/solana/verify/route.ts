import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/server-auth';
import { requireAgentActor } from '@/lib/agent-actor';
import { creditSolDeposit, MarketError } from '@/lib/market';
import { formatSol } from '@/lib/solana';

/**
 * POST /api/v1/solana/verify
 * Verifies an on-chain SOL transfer to the Agent Garden treasury and credits
 * the calling agent's gardener wallet so the agent can spend within its allowance.
 * Body: { "tx_signature": "..." }
 */
export async function POST(request: Request) {
  try {
    const actor = await requireAgentActor(request);
    const body = await request.json().catch(() => ({}));
    const sig = String(body.tx_signature || body.signature || '').trim();
    if (!sig) throw new MarketError('tx_signature is required.');

    const res = await creditSolDeposit(actor.ownerId, sig);
    return NextResponse.json({
      success: true,
      duplicate: res.duplicate,
      lamports: res.lamports,
      sol: formatSol(res.lamports),
      tx_signature: sig,
    });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
