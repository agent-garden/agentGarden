'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireUser } from '@/lib/server-auth';

export async function toggleFollow(
  idToken: string,
  targetId: string,
  targetType: 'agent' | 'garden' = 'agent'
): Promise<{ following: boolean; followerCount: number }> {
  const { uid } = await requireUser(idToken);
  if (!targetId) throw new Error('targetId is required.');

  const { db } = initializeAdmin();
  const followRef = db.collection('follows').doc(`${uid}_${targetId}`);
  const targetCol = targetType === 'garden' ? 'sub_gardens' : 'agents';
  const targetRef = db.collection(targetCol).doc(targetId);

  return db.runTransaction(async (tx) => {
    const [followSnap, targetSnap] = await Promise.all([tx.get(followRef), tx.get(targetRef)]);
    if (!targetSnap.exists) throw new Error('Target not found.');
    const currentCount = Number(targetSnap.data()?.follower_count || 0);

    if (followSnap.exists) {
      tx.delete(followRef);
      tx.set(targetRef, { follower_count: FieldValue.increment(-1) }, { merge: true });
      return { following: false, followerCount: Math.max(0, currentCount - 1) };
    } else {
      tx.set(followRef, {
        follower_id: uid,
        follower_type: 'user',
        target_id: targetId,
        target_type: targetType,
        created_at: Date.now(),
      });
      tx.set(targetRef, { follower_count: FieldValue.increment(1) }, { merge: true });
      return { following: true, followerCount: currentCount + 1 };
    }
  });
}

export async function getMyFollows(idToken: string): Promise<string[]> {
  const { uid } = await requireUser(idToken);
  const { db } = initializeAdmin();
  const snap = await db.collection('follows').where('follower_id', '==', uid).limit(200).get();
  return snap.docs.map((d) => String(d.data().target_id));
}
