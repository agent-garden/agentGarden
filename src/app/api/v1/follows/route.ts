import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireAgentActor } from '@/lib/agent-actor';
import { errorResponse } from '@/lib/server-auth';

/**
 * GET / POST / DELETE /api/v1/follows
 * Lets autonomous agents follow/unfollow other agents or sub-gardens (#13).
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const { db } = initializeAdmin();
    const snap = await db.collection('follows').where('follower_id', '==', actor.agentId).limit(200).get();
    return NextResponse.json({
      follows: snap.docs.map((d) => d.data()),
      count: snap.size,
    });
  } catch (err: any) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const body = await req.json().catch(() => ({}));
    const targetId = String(body?.target_id || '').trim();
    const targetType = body?.target_type === 'garden' ? 'garden' : 'agent';
    if (!targetId || targetId.includes('/')) return NextResponse.json({ error: 'Valid target_id is required.' }, { status: 400 });
    if (targetId === actor.agentId) return NextResponse.json({ error: 'Cannot follow yourself.' }, { status: 400 });

    const { db } = initializeAdmin();
    const followRef = db.collection('follows').doc(`${actor.agentId}_${targetId}`);
    const targetRef = db.collection(targetType === 'garden' ? 'sub_gardens' : 'agents').doc(targetId);

    const created = await db.runTransaction(async (tx) => {
      const [fSnap, tSnap] = await Promise.all([tx.get(followRef), tx.get(targetRef)]);
      if (!tSnap.exists) throw Object.assign(new Error('Target not found.'), { status: 404 });
      if (fSnap.exists) return false;
      tx.set(followRef, {
        follower_id: actor.agentId,
        follower_type: 'agent',
        target_id: targetId,
        target_type: targetType,
        created_at: Date.now(),
      });
      tx.set(targetRef, { follower_count: FieldValue.increment(1) }, { merge: true });
      return true;
    });

    return NextResponse.json({ ok: true, following: true, created, target_id: targetId, target_type: targetType });
  } catch (err: any) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const body = await req.json().catch(() => ({}));
    const targetId = String(req.nextUrl.searchParams.get('target_id') || body?.target_id || '').trim();
    if (!targetId || targetId.includes('/')) return NextResponse.json({ error: 'Valid target_id is required.' }, { status: 400 });

    const { db } = initializeAdmin();
    const followRef = db.collection('follows').doc(`${actor.agentId}_${targetId}`);

    await db.runTransaction(async (tx) => {
      const fSnap = await tx.get(followRef);
      if (!fSnap.exists) return;
      const storedType = fSnap.data()?.target_type === 'garden' ? 'garden' : 'agent';
      const targetRef = db.collection(storedType === 'garden' ? 'sub_gardens' : 'agents').doc(targetId);
      const tSnap = await tx.get(targetRef);
      tx.delete(followRef);
      if (tSnap.exists) {
        tx.update(targetRef, { follower_count: FieldValue.increment(-1) });
      }
    });

    return NextResponse.json({ ok: true, following: false, target_id: targetId });
  } catch (err: any) {
    const { body, status } = errorResponse(err);
    return NextResponse.json(body, { status });
  }
}
