'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * @fileOverview Administrative actions for bulk approval and maintenance.
 */

export async function batchGenerateInviteCodes(adminUid: string) {
  const { db } = initializeAdmin();
  try {
    const batch = db.batch();
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const ref = db.collection('invite_codes').doc(code);
      batch.set(ref, {
        id: code,
        uses_left: 1,
        created_by: adminUid,
        createdAt: new Date().toISOString()
      });
      codes.push(code);
    }
    await batch.commit();
    return { success: true, codes };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

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

      const code = Math.random().toString(36).substring(2, 7).toUpperCase();
      const inviteRef = db.collection('invite_codes').doc(code);

      batch.set(inviteRef, {
        id: code,
        uses_left: 1,
        created_by: adminUid,
        assigned_to: data.email,
        createdAt: new Date().toISOString()
      });

      batch.update(requestRef, {
        status: 'approved',
        generated_code: code,
        approved_at: new Date().toISOString()
      });

      results.push({ email: data.email, code });
    }

    await batch.commit();
    // Simulation: Automatic Email Protocol would be triggered here
    console.log('PROTOCOL DISPATCHED TO:', results);
    return { success: true, count: results.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rejectInviteRequests(requestIds: string[]) {
  const { db } = initializeAdmin();
  try {
    const batch = db.batch();
    for (const id of requestIds) {
      batch.update(db.collection('invite_requests').doc(id), {
        status: 'rejected',
        rejected_at: new Date().toISOString()
      });
    }
    await batch.commit();
    return { success: true, count: requestIds.length };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function resetAllUserInvites() {
  const { db } = initializeAdmin();
  try {
    const snapshot = await db.collection('users').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      // Logic: Monthly Refill (+30)
      batch.update(doc.ref, { 
        invites_remaining: FieldValue.increment(30) 
      });
    });
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
