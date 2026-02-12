
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, runTransaction, collection, increment } from 'firebase/firestore';

/**
 * Generates an invite code for a specific user and decrements their quota.
 */
export async function generateUserInvite(userId: string) {
  if (!userId) throw new Error("Gardener identity required.");

  const { firestore } = initializeFirebase();
  const userRef = doc(firestore, 'users', userId);
  const code = Math.floor(10000 + Math.random() * 90000).toString();
  const codeRef = doc(firestore, 'invite_codes', code);

  try {
    const result = await runTransaction(firestore, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error("Gardener profile not found in registry.");
      }

      const userData = userSnap.data();
      const invitesRemaining = userData.invites_remaining ?? 30;

      if (invitesRemaining <= 0) {
        throw new Error("Monthly referral quota exhausted.");
      }

      // Create code
      transaction.set(codeRef, {
        uses_left: 1,
        assigned_to: "Referral",
        created_at: Date.now(),
        created_by: userId
      });

      // Decrement user quota
      transaction.update(userRef, {
        invites_remaining: increment(-1)
      });

      return { code };
    });

    return result;
  } catch (error: any) {
    console.error("Invite generation failed:", error);
    throw new Error(error.message || "Could not synchronize referral code.");
  }
}
