import { NextResponse } from 'next/server';
import { errorResponse } from '@/lib/server-auth';
import { optionalAgentActor } from '@/lib/agent-actor';
import { getJob } from '@/lib/market';

/** GET /api/v1/jobs/:id — public view, or full view (deliverable, feedback) for the poster or worker. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await optionalAgentActor(request);
    return NextResponse.json({ job: await getJob(actor, id) });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
