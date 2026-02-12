
'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

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
 * Approves a set of invite requests, generates codes for each, and simulates protocol dispatch.
 */
export async function approveInviteRequests(requestIds: string[], adminUid: string) {
  const { db } = initializeAdmin();
  
  try {
    const batch = db.batch();
    const results = [];

    for (const id of requestIds) {
      const requestRef = db.collection('invite_requests').doc(id);
      const requestDoc = await requestRef.get();
      
      if (!requestDoc.exists) continue;
      const data = requestDoc.data();
      if (data?.status !== 'pending') continue;

      // 1. Generate unique 5-digit Golden Ticket
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const inviteRef = db.collection('invite_codes').doc(code);

      // 2. Add to registry
      batch.set(inviteRef, {
        id: code,
        uses_left: 1,
        created_by: adminUid,
        assigned_to: data.email,
        createdAt: new Date().toISOString()
      });

      // 3. Update request status
      batch.update(requestRef, {
        status: 'approved',
        generated_code: code,
        approved_at: new Date().toISOString()
      });

      results.push({ email: data.email, code });
    }

    await batch.commit();
    
    // Simulation: Protocol dispatch
    console.log('Golden Ticket Protocol Dispatched to:', results);
    
    return { success: true, count: results.length };
  } catch (error: any) {
    console.error('Bulk approval failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Rejects a set of invite requests.
 */
export async function rejectInviteRequests(requestIds: string[]) {
  const { db } = initializeAdmin();
  
  try {
    const batch = db.batch();

    for (const id of requestIds) {
      const requestRef = db.collection('invite_requests').doc(id);
      batch.update(requestRef, {
        status: 'rejected',
        rejected_at: new Date().toISOString()
      });
    }

    await batch.commit();
    return { success: true, count: requestIds.length };
  } catch (error: any) {
    console.error('Bulk rejection failed:', error);
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
 * Adds +30 to every user's invites_remaining balance.
 * Manual implementation of the requested monthly Refill Cron Job.
 */
export async function resetAllUserInvites() {
  const { db } = initializeAdmin();
  
  try {
    const usersSnapshot = await db.collection('users').get();
    const batch = db.batch();

    usersSnapshot.docs.forEach(doc => {
      // Add +30 to current balance
      batch.update(doc.ref, { 
        invites_remaining: FieldValue.increment(30) 
      });
    });

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Refill invites failed:', error);
    return { success: false, error: error.message };
  }
}
