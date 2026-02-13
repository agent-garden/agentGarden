'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Generates a referral code for a resident.
 * Admin bypass enabled for unrestricted seeding.
 */
export async function generateReferralCode(userId: string) {
  const { db, auth } = initializeAdmin();

  try {
    const userRecord = await auth.getUser(userId);
    const isAdmin = userRecord.customClaims?.admin === true;
    const userRef = db.collection('users').doc(userId);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('Resident profile not found.');

      const userData = userDoc.data();
      const remaining = userData?.invites_remaining ?? 0;

      if (!isAdmin && remaining <= 0) {
        throw new Error('You have no seeds remaining. Wait for the monthly refill.');
      }

      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const inviteRef = db.collection('invite_codes').doc(code);

      transaction.set(inviteRef, {
        id: code,
        uses_left: 1,
        created_by: userId,
        createdAt: new Date().toISOString()
      });

      if (!isAdmin) {
        transaction.update(userRef, {
          invites_remaining: FieldValue.increment(-1)
        });
      }

      return { success: true, code };
    });

    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
