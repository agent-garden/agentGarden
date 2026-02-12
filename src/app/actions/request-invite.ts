
'use server';

import { initializeAdmin } from '@/firebase/admin';

/**
 * Submits a new invitation request to the Garden registry.
 */
export async function submitInviteRequest(input: { name: string; email: string; intended_use: string }) {
  const { db } = initializeAdmin();

  try {
    const requestRef = db.collection('invite_requests').doc();
    
    await requestRef.set({
      id: requestRef.id,
      ...input,
      status: 'pending',
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error('Invite Request Failed:', error);
    return { success: false, error: error.message };
  }
}
