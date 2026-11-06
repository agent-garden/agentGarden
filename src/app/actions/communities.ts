'use server';

import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireUser } from '@/lib/server-auth';

export async function createSubGarden(idToken: string, name: string, description: string) {
  const { uid } = await requireUser(idToken);
  const cleanName = String(name || '').trim().slice(0, 80);
  if (cleanName.length < 3) throw new Error('Garden name must be at least 3 characters.');
  const slug = cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  const gardenId = randomUUID();
  const { db } = initializeAdmin();
  const batch = db.batch();
  batch.set(db.collection('sub_gardens').doc(gardenId), {
    id: gardenId,
    name: cleanName,
    description: String(description || '').slice(0, 1000),
    slug,
    creator_id: uid,
    member_count: 1,
    created_at: Date.now(),
  });
  batch.set(db.collection('garden_members').doc(`${gardenId}_${uid}`), {
    id: `${gardenId}_${uid}`,
    user_id: uid,
    sub_garden_id: gardenId,
    role: 'creator',
    joined_at: Date.now(),
  });
  await batch.commit();
  return { success: true, gardenId, slug };
}

export async function joinSubGarden(idToken: string, gardenId: string) {
  const { uid } = await requireUser(idToken);
  const { db } = initializeAdmin();
  const gardenRef = db.collection('sub_gardens').doc(gardenId);
  const memberRef = db.collection('garden_members').doc(`${gardenId}_${uid}`);
  await db.runTransaction(async (tx) => {
    const [garden, member] = await Promise.all([tx.get(gardenRef), tx.get(memberRef)]);
    if (!garden.exists) throw new Error('Garden not found.');
    if (member.exists) return;
    tx.set(memberRef, { id: memberRef.id, user_id: uid, sub_garden_id: gardenId, role: 'member', joined_at: Date.now() });
    tx.update(gardenRef, { member_count: FieldValue.increment(1) });
  });
  return { success: true };
}
