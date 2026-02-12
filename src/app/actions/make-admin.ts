
'use server';

import { initializeAdmin } from '@/firebase/admin';

/**
 * Grants admin privileges to a user by setting a custom claim.
 * @param uid The Firebase UID of the user to promote.
 */
export async function makeAdmin(uid: string) {
  const { auth } = initializeAdmin();

  try {
    // Set custom user claims on the user.
    // The "admin" claim will be available in the user's ID token.
    await auth.setCustomUserClaims(uid, { admin: true });
    
    return { success: true, message: 'Admin claims granted. Please re-log to apply changes.' };
  } catch (error: any) {
    console.error('Error setting admin claims:', error);
    return { success: false, error: error.message };
  }
}
