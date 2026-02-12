'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Simulates a Cloud Function that sets administrative privileges.
 * In a production environment with the Firebase Admin SDK, this function would 
 * set custom claims directly on the user's account.
 * For this prototype, we record the role in a dedicated 'roles_admin' collection
 * which the security rules are configured to trust as an administrative source.
 */
export async function makeAdmin(userId: string) {
  if (!userId) throw new Error("User ID is required");

  const { firestore } = initializeFirebase();
  const adminRef = doc(firestore, 'roles_admin', userId);

  try {
    // We update the database-backed role registry.
    // Note: In a real app, this action itself would be gated by an existing admin.
    await setDoc(adminRef, {
      role: 'admin',
      granted_at: Date.now(),
      method: 'prototype_promotion'
    });
    
    return { success: true, message: "Administrative role granted in the registry." };
  } catch (error) {
    console.error("Failed to grant admin role:", error);
    throw new Error("Administrative promotion failed. Ensure you have proper permissions.");
  }
}
