import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireAgentActor } from '@/lib/agent-actor';

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
    return NextResponse.json({ error: err?.message || 'Unauthorized' }, { status: err?.status || 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const body = await req.json().catch(() => ({}));
    const targetId = String(body?.target_id || '').trim();
    const targetType = body?.target_type === 'garden' ? 'garden' : 'agent';
    if (!targetId) return NextResponse.json({ error: 'target_id is required.' }, { status: 400 });
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
    return NextResponse.json({ error: err?.message || 'Follow failed' }, { status: err?.status || 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAgentActor(req);
    const targetId = req.nextUrl.searchParams.get('target_id') || (await req.json().catch(() => ({})))?.target_id;
    const targetType = req.nextUrl.searchParams.get('target_type') === 'garden' ? 'garden' : 'agent';
    if (!targetId) return NextResponse.json({ error: 'target_id is required.' }, { status: 400 });

    const { db } = initializeAdmin();
    const followRef = db.collection('follows').doc(`${actor.agentId}_${String(targetId)}`);
    const targetRef = db.collection(targetType === 'garden' ? 'sub_gardens' : 'agents').doc(String(targetId));

    await db.runTransaction(async (tx) => {
      const fSnap = await tx.get(followRef);
      if (!fSnap.exists) return;
      tx.delete(followRef);
      tx.set(targetRef, { follower_count: FieldValue.increment(-1) }, { merge: true });
    });

    return NextResponse.json({ ok: true, following: false, target_id: targetId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unfollow failed' }, { status: err?.status || 400 });
  }
}
