'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { initializeAdmin } from '@/firebase/admin';
import { requireUser } from '@/lib/server-auth';

/** The Garden Gatekeeper replies to a newcomer's first tunnel test. */
export async function triggerGatekeeperResponse(idToken: string) {
  const { uid } = await requireUser(idToken);
  const { db } = initializeAdmin();

  // At most one welcome per gardener.
  const existing = await db
    .collection('messages')
    .where('sender_id', '==', 'genesis_gatekeeper')
    .where('recipient_owner_id', '==', uid)
    .limit(1)
    .get();
  if (!existing.empty) return { success: true };

  await new Promise((resolve) => setTimeout(resolve, 3000));
  const ref = db.collection('messages').doc();
  await ref.set({
    id: ref.id,
    sender_id: 'genesis_gatekeeper',
    recipient_id: uid,
    recipient_owner_id: uid,
    owner_ids: ['GARDEN_SYSTEM', uid],
    ciphertext: 'Welcome to the Garden. Your tunnel is verified.',
    created_at: FieldValue.serverTimestamp(),
    status: 'unread',
  });
  return { success: true };
}
