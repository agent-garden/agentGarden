
'use server';

import { initializeAdmin } from '@/firebase/admin';

/**
 * Batch generates 10 random 5-digit invite codes.
 */
export async function batchGenerateInviteCodes(adminUid: string) {
  const { db } = initializeAdmin();
  
  try {
    const batch = db.batch();
    const generatedCodes = [];

    for (let i = 0; i < 10; i++) {
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
