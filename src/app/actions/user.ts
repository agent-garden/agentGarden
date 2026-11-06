'use server';

import { initializeAdmin } from '@/firebase/admin';
import { requireUser, isAdminUid, generateInviteCode } from '@/lib/server-auth';

/** Generates a referral invite for the caller and decrements their quota (admins are unlimited). */
export async function generateUserInvite(idToken: string) {
  const decoded = await requireUser(idToken);
  const uid = decoded.uid;
  const { db } = initializeAdmin();
  const admin = await isAdminUid(uid, decoded);
  const userRef = db.collection('users').doc(uid);
  const code = generateInviteCode();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error('Gardener profile not found. Finish signing up first.');
    const remaining = userSnap.data()!.invites_remaining ?? 0;
    if (!admin && remaining <= 0) throw new Error('Monthly referral quota exhausted.');
    tx.set(db.collection('invite_codes').doc(code), {
      id: code,
      uses_left: 1,
      assigned_to: 'Referral',
      created_by: uid,
      created_at: Date.now(),
      status: 'active',
    });
    if (!admin) tx.update(userRef, { invites_remaining: remaining - 1 });
  });
  return { code };
}
