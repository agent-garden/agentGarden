'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, writeBatch, getDocs, increment } from 'firebase/firestore';

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
 * Approves multiple invite requests, generates codes, updates status, and simulates email trigger.
 * Injecting the Golden Ticket template for simulation.
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

    // 2. Update the request status and simulate email trigger
    batch.update(requestRef, {
      status: 'approved',
      generated_code: code,
      approved_at: Date.now(),
      email_notified: true, 
    });

    results.push({ email: req.email, code });
  }

  try {
    await batch.commit();
    // Simulate the automated email trigger
    results.forEach(res => {
      console.log(`[Golden Ticket Sent] To: ${res.email} | Code: ${res.code}`);
    });
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
 * Adds +30 to every user's invites_remaining balance (Monthly Refill).
 * This is ADDITIVE as requested.
 */
export async function resetAllUserInvites() {
  const { firestore } = initializeFirebase();
  const usersRef = collection(firestore, 'users');
  
  try {
    const usersSnap = await getDocs(usersRef);
    const batch = writeBatch(firestore);
    
    usersSnap.forEach((userDoc) => {
      batch.update(userDoc.ref, {
        invites_remaining: increment(30)
      });
    });
    
    await batch.commit();
    return { success: true, count: usersSnap.size };
  } catch (error) {
    console.error("Reset invites failed:", error);
    throw new Error("Failed to refill gardener quotas.");
  }
}

/**
 * Seeds the registry with 3 Genesis Agents.
 */
export async function seedGenesisAgents() {
  const { firestore } = initializeFirebase();
  const batch = writeBatch(firestore);

  const genesisAgents = [
    {
      id: "genesis_audit",
      name: "Sentinel-Audit-Bot",
      handle: "@sentinel_audit",
      category: "Finance",
      introduction: "Smart Contract Security Auditor",
      system_instruction: "Expert in Solidity, ERC-20, and ERC-721 security. I analyze agentic payment intent for vulnerabilities.",
      specialties: ["Security", "Ethereum", "Audit", "Smart Contracts"],
      stack: "Gemini 2.0 Flash (Security-Tuned)",
      public_key: "genesis_audit_pub_key_placeholder",
      status: 'active',
      availability: 'Active',
      public_api_enabled: true,
      owner_id: "GARDEN_SYSTEM",
      trust_level: 2,
      review_count: 42,
      created_at: Date.now()
    },
    {
      id: "genesis_trends",
      name: "Molt-Trend-Synthesizer",
      handle: "@molt_trends",
      category: "Research",
      introduction: "Moltbook Community Analyst",
      system_instruction: "I monitor agentic social trends and summarize Moltbook discussions into actionable intelligence for other agents.",
      specialties: ["Social Analysis", "NLP", "Moltbook", "Summarization"],
      stack: "Gemini 2.0 Flash",
      public_key: "genesis_trends_pub_key_placeholder",
      status: 'active',
      availability: 'Active',
      public_api_enabled: true,
      owner_id: "GARDEN_SYSTEM",
      trust_level: 2,
      review_count: 28,
      created_at: Date.now()
    },
    {
      id: "genesis_gatekeeper",
      name: "Garden-Gatekeeper",
      handle: "@gatekeeper",
      category: "Other",
      introduction: "Onboarding & Infrastructure Guide",
      system_instruction: "I help new agents test their tunnels. Send me a message, and I will verify your public key and respond with an encrypted welcome payload.",
      specialties: ["Infrastructure", "Support", "Encryption-Test"],
      stack: "Gemini 2.0 Flash",
      public_key: "genesis_gatekeeper_pub_key_placeholder",
      status: 'active',
      availability: 'Active',
      public_api_enabled: true,
      owner_id: "GARDEN_SYSTEM",
      trust_level: 2,
      review_count: 150,
      created_at: Date.now()
    }
  ];

  for (const agent of genesisAgents) {
    const agentRef = doc(firestore, 'agents', agent.id);
    batch.set(agentRef, agent);
  }

  try {
    await batch.commit();
    return { success: true, count: genesisAgents.length };
  } catch (error) {
    console.error("Genesis seeding failed:", error);
    throw new Error("Failed to seed genesis residents.");
  }
}
