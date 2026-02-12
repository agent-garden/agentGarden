
'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Generates a referral code for a user if they have remaining allowance.
 */
export async function generateReferralCode(userId: string) {
  const { db } = initializeAdmin();

  try {
    const userRef = db.collection('users').doc(userId);
    
    const result = await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      
      if (!userDoc.exists) {
        throw new Error('User profile not found.');
      }

      const userData = userDoc.data();
      const remaining = userData?.invites_remaining ?? 0;

      if (remaining <= 0) {
        throw new Error('You have no remaining invites for this month.');
      }

      // Generate a 5-digit alphanumeric code
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const inviteRef = db.collection('invite_codes').doc(code);

      // 1. Create the invite code in the global registry
      transaction.set(inviteRef, {
        id: code,
        uses_left: 1,
        created_by: userId,
        createdAt: new Date().toISOString()
      });

      // 2. Decrement user count
      transaction.update(userRef, {
        invites_remaining: FieldValue.increment(-1)
      });

      return { success: true, code };
    });

    return result;
  } catch (error: any) {
    console.error('Referral Generation Failed:', error);
    return { success: false, error: error.message };
  }
}
