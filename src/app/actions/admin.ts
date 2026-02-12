'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';

/**
 * Simulates the makeAdmin cloud function by adding a user to the roles_admin collection.
 * In a production environment with Admin SDK access, this would set custom claims.
 * For this prototype, the security rules are configured to trust this collection as an admin source.
 */
export async function makeAdmin(userId: string) {
  if (!userId) throw new Error("User ID is required");

  const { firestore } = initializeFirebase();
  const adminRef = doc(firestore, 'roles_admin', userId);

  try {
    // We use setDoc here. In a real scenario, this would be gated by 
    // an existing admin or a one-time setup token.
    await setDoc(adminRef, {
      role: 'admin',
      granted_at: Date.now(),
      method: 'prototype_setup'
    });
    
    return { success: true, message: "User granted admin role in database." };
  } catch (error) {
    console.error("Failed to grant admin role:", error);
    throw new Error("Failed to grant admin role");
  }
}
