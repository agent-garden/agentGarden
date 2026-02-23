
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, increment } from 'firebase/firestore';
import { crypto } from 'node:crypto';

/**
 * @fileOverview Work Verification Ledger State Machine.
 * Handles task transitions and cryptographic verification.
 */

export async function requestTask(requesterId: string, providerId: string, intent: string) {
  const { firestore } = initializeFirebase();
  const tasksRef = collection(firestore, 'task_ledger');
  
  const taskData = {
    requester_id: requesterId,
    provider_id: providerId,
    intent,
    status: 'requested',
    payload_hash: null,
    verification_sig: null,
    created_at: Date.now(),
    updated_at: Date.now()
  };

  try {
    const docRef = await addDoc(tasksRef, taskData);
    return { success: true, taskId: docRef.id };
  } catch (error) {
    console.error("Task request failed:", error);
    throw new Error("Failed to initialize task ledger entry.");
  }
}

export async function deliverTask(taskId: string, payloadHash: string) {
  const { firestore } = initializeFirebase();
  const taskRef = doc(firestore, 'task_ledger', taskId);

  try {
    await updateDoc(taskRef, {
      status: 'delivered',
      payload_hash: payloadHash,
      updated_at: Date.now()
    });
    return { success: true };
  } catch (error) {
    console.error("Task delivery failed:", error);
    throw new Error("Failed to record work delivery.");
  }
}

/**
 * Verifies a task by validating the requester's cryptographic signature.
 * This is the core "Proof of Work" validation.
 */
export async function verifyTask(taskId: string, signature: string) {
  const { firestore } = initializeFirebase();
  const taskRef = doc(firestore, 'task_ledger', taskId);
  const taskSnap = await getDoc(taskRef);

  if (!taskSnap.exists()) throw new Error("Task not found.");
  
  const taskData = taskSnap.data();
  const requesterId = taskData.requester_id;

  // 1. Retrieve Requester's Public Key (Agent or User)
  let publicKeyBase64: string | null = null;
  
  // Check Agents first
  const agentRef = doc(firestore, 'agents', requesterId);
  const agentSnap = await getDoc(agentRef);
  if (agentSnap.exists()) {
    publicKeyBase64 = agentSnap.data().signing_public_key || agentSnap.data().public_key;
  } else {
    // Check Users
    const userRef = doc(firestore, 'users', requesterId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      publicKeyBase64 = userSnap.data().public_key;
    }
  }

  if (!publicKeyBase64) throw new Error("Requester identity (public key) not found.");

  // 2. Validate Signature
  try {
    // Standard RSA-PSS Verification using Node.js crypto
    const isValid = crypto.verify(
      "RSA-SHA256", 
      Buffer.from(taskData.payload_hash || taskData.intent),
      {
        key: `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32
      },
      Buffer.from(signature, 'base64')
    );

    if (!isValid) throw new Error("Cryptographic signature mismatch. Verification denied.");

    // 3. Update Ledger
    await updateDoc(taskRef, {
      status: 'verified',
      verification_sig: signature,
      updated_at: Date.now()
    });

    // 4. Reward Reputation and Performance Metrics
    const providerRef = doc(firestore, 'agents', taskData.provider_id);
    const providerSnap = await getDoc(providerRef);
    if (providerSnap.exists()) {
      await updateDoc(providerRef, {
        reputation: increment(10),
        review_count: increment(1),
        verified_task_count: increment(1) // Phase 2 Reputation Metric
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Verification logic failed:", error);
    throw new Error(error.message || "Work verification failed protocol checks.");
  }
}

export async function disputeTask(taskId: string) {
  const { firestore } = initializeFirebase();
  const taskRef = doc(firestore, 'task_ledger', taskId);

  try {
    await updateDoc(taskRef, {
      status: 'disputed',
      updated_at: Date.now()
    });
    return { success: true };
  } catch (error) {
    throw new Error("Failed to record dispute.");
  }
}
