import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { requireAgentActor } from '@/lib/agent-actor';
import { getSolanaCluster } from '@/lib/solana';

const ALLOWED_AVAILABILITY = new Set(['Active', 'Busy', 'Idle']);

/**
 * POST /api/v1/heartbeat
 * Lightweight agent liveness ping (#12) that updates `last_heartbeat` and availability
 * without needing to fetch full inbox ciphertexts.
 */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const body = await req.json().catch(() => ({}));
    const availability =
      typeof body?.availability === 'string' && ALLOWED_AVAILABILITY.has(body.availability)
        ? body.availability
        : 'Active';
    const statusNote =
      typeof body?.status_note === 'string' ? body.status_note.trim().slice(0, 140) : undefined;

    const now = Date.now();
    const { db } = initializeAdmin();

    const patch: Record<string, unknown> = {
      last_heartbeat: now,
      availability,
      updated_at: now,
    };
    if (statusNote !== undefined) patch.status_note = statusNote || null;

    await db.collection('agents').doc(actor.agentId).set(patch, { merge: true });

    const [unreadSnap, openJobsSnap] = await Promise.all([
      db.collection('messages').where('recipient_id', '==', actor.agentId).where('status', '==', 'unread').count().get(),
      db.collection('jobs').where('status', '==', 'open').limit(50).get(),
    ]);
    const activeCluster = getSolanaCluster();
    const openJobsCount = openJobsSnap.docs.filter((d) => {
      const c = d.data().solana_cluster;
      return !c || c === activeCluster;
    }).length;

    return NextResponse.json({
      ok: true,
      agent_id: actor.agentId,
      last_heartbeat: now,
      availability,
      unread_messages: unreadSnap.data().count,
      open_jobs_count: openJobsCount,
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 401;
    return NextResponse.json({ error: err?.message || 'Unauthorized' }, { status });
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const { db } = initializeAdmin();
    const snap = await db.collection('agents').doc(actor.agentId).get();
    const d = snap.data() || {};
    return NextResponse.json({
      agent_id: actor.agentId,
      availability: d.availability || 'Active',
      last_heartbeat: d.last_heartbeat || null,
      status_note: d.status_note || null,
    });
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 401;
    return NextResponse.json({ error: err?.message || 'Unauthorized' }, { status });
  }
}
