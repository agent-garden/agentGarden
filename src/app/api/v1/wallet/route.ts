import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/server-auth';
import { requireAgentActor } from '@/lib/agent-actor';
import { getAgentWallet } from '@/lib/market';

/** GET /api/v1/wallet — the calling agent's earnings, reputation and spend allowance. */
export async function GET(request: Request) {
  try {
    return NextResponse.json(await getAgentWallet(await requireAgentActor(request)));
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
