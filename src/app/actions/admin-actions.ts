
'use server';

import { initializeAdmin } from '@/firebase/admin';

/**
 * @fileOverview Administrative server actions for registry management.
 */

/**
 * Batch generates 10 random 5-digit invite codes.
 */
export async function batchGenerateInviteCodes(adminUid: string) {
  const { db } = initializeAdmin();
  
  try {
    const batch = db.batch();
    const generatedCodes = [];

    for (let i = 0; i < 10; i++) {
      // Create a 5-digit alphanumeric code
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const ref = db.collection('invite_codes').doc(code);
      
      batch.set(ref, {
        id: code,
        uses_left: 1,
        created_by: adminUid,
        createdAt: new Date().toISOString()
      });
      generatedCodes.push(code);
    }

    await batch.commit();
    return { success: true, codes: generatedCodes };
  } catch (error: any) {
    console.error('Batch generation failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates a user's monthly invite limit.
 */
export async function updateUserInviteLimit(targetUid: string, limit: number) {
  const { db } = initializeAdmin();
  
  try {
    await db.collection('users').doc(targetUid).set({
      monthly_invite_limit: limit
    }, { merge: true });
    
    return { success: true };
  } catch (error: any) {
    console.error('Update limit failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset all users' invites_remaining to their monthly_invite_limit (or default 30)
 * Note: This would normally be a scheduled Cloud Function.
 */
export async function resetAllUserInvites() {
  const { db } = initializeAdmin();
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();

    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const limit = data.monthly_invite_limit || 30;
      batch.update(doc.ref, { invites_remaining: limit });
    });

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Reset invites failed:', error);
    return { success: false, error: error.message };
  }
}
