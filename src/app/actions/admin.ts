'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, writeBatch, getDocs } from 'firebase/firestore';

/**
 * Bootstraps administrative privileges for a gardener.
 */
export async function setAdminPrivileges(userId: string) {
  if (!userId) throw new Error("Gardener identity (UID) is required.");

  const { firestore } = initializeFirebase();
  const adminRef = doc(firestore, 'roles_admin', userId);

  try {
    await setDoc(adminRef, {
      role: 'admin',
      granted_at: Date.now(),
      method: 'prototype_bootstrap'
    });
    
    return { success: true, message: "Administrative privileges synchronized in the registry." };
  } catch (error: any) {
    console.error("Failed to set admin privileges:", error);
    throw new Error(error.message || "Administrative promotion failed.");
  }
}

/**
 * Generates 10 random 5-digit codes and saves them to invite_codes.
 */
export async function batchGenerateInviteCodes() {
  const { firestore } = initializeFirebase();
  const batch = writeBatch(firestore);

  for (let i = 0; i < 10; i++) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const codeRef = doc(firestore, 'invite_codes', code);
    batch.set(codeRef, {
      uses_left: 1,
      assigned_to: "Unassigned",
      created_at: Date.now()
    });
  }

  try {
    await batch.commit();
    return { success: true, message: "10 invite codes generated." };
  } catch (error) {
    console.error("Batch generate failed:", error);
    throw new Error("Failed to generate batch codes.");
  }
}

/**
 * Approves multiple invite requests, generates codes, and updates status.
 */
export async function approveInviteRequests(requests: { id: string, email: string }[]) {
  const { firestore } = initializeFirebase();
  const batch = writeBatch(firestore);
  const results: { email: string, code: string }[] = [];

  for (const req of requests) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const codeRef = doc(firestore, 'invite_codes', code);
    const requestRef = doc(firestore, 'invite_requests', req.id);

    // 1. Create the invite code
    batch.set(codeRef, {
      uses_left: 1,
      assigned_to: req.email,
      created_at: Date.now(),
      status: 'active'
    });

    // 2. Update the request status
    batch.update(requestRef, {
      status: 'approved',
      generated_code: code,
      approved_at: Date.now()
    });

    results.push({ email: req.email, code });
  }

  try {
    await batch.commit();
    return { success: true, results };
  } catch (error) {
    console.error("Bulk approval failed:", error);
    throw new Error("Failed to process bulk approvals.");
  }
}

/**
 * Updates a user's monthly invite limit.
 */
export async function updateMonthlyLimit(userId: string, limit: number) {
  const { firestore } = initializeFirebase();
  const userRef = doc(firestore, 'users', userId);

  try {
    await updateDoc(userRef, {
      monthly_invite_limit: limit
    });
    return { success: true, message: "User limit updated." };
  } catch (error) {
    console.error("Update limit failed:", error);
    throw new Error("Failed to update user limit.");
  }
}

/**
 * Resets all users' invites_remaining to their monthly_invite_limit.
 */
export async function resetAllUserInvites() {
  const { firestore } = initializeFirebase();
  const usersRef = collection(firestore, 'users');
  
  try {
    const usersSnap = await getDocs(usersRef);
    const batch = writeBatch(firestore);
    
    usersSnap.forEach((userDoc) => {
      const data = userDoc.data();
      batch.update(userDoc.ref, {
        invites_remaining: data.monthly_invite_limit || 30
      });
    });
    
    await batch.commit();
    return { success: true, count: usersSnap.size };
  } catch (error) {
    console.error("Reset invites failed:", error);
    throw new Error("Failed to reset gardener quotas.");
  }
}
