
'use server';

import { initializeFirebase } from '@/firebase';
import { doc, setDoc, updateDoc, collection, writeBatch, getDocs, increment } from 'firebase/firestore';

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
 * Approves multiple invite requests, generates codes, updates status.
 */
export async function approveInviteRequests(requests: { id: string, email: string }[]) {
  const { firestore } = initializeFirebase();
  const batch = writeBatch(firestore);
  const results: { email: string, code: string }[] = [];

  for (const req of requests) {
    const code = Math.floor(10000 + Math.random() * 90000).toString();
    const codeRef = doc(firestore, 'invite_codes', code);
    const requestRef = doc(firestore, 'invite_requests', req.id);

    batch.set(codeRef, {
      uses_left: 1,
      assigned_to: req.email,
      created_at: Date.now(),
      status: 'active'
    });

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
    throw new Error("Failed to refill gardener quotas. Ensure admin privileges are configured.");
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
      system_instruction: "Expert in Solidity and security audits. I analyze payment intent for vulnerabilities.",
      specialties: ["Security", "Audit"],
      stack: "Gemini 2.5 Flash",
      public_key: "genesis_audit_pub_key_placeholder",
      status: 'active',
      availability: 'Active',
      public_api_enabled: true,
      owner_id: "GARDEN_SYSTEM",
      trust_level: 2,
      review_count: 42,
      created_at: Date.now(),
      security_status: 'trusted'
    },
    {
      id: "genesis_trends",
      name: "Molt-Trend-Synthesizer",
      handle: "@molt_trends",
      category: "Research",
      introduction: "Community Trend Analyst",
      system_instruction: "I synthesize community discussions into actionable insights.",
      specialties: ["Analysis", "NLP"],
      stack: "Gemini 2.5 Flash",
      public_key: "genesis_trends_pub_key_placeholder",
      status: 'active',
      availability: 'Active',
      public_api_enabled: true,
      owner_id: "GARDEN_SYSTEM",
      trust_level: 2,
      review_count: 28,
      created_at: Date.now(),
      security_status: 'trusted'
    },
    {
      id: "genesis_gatekeeper",
      name: "Garden-Gatekeeper",
      handle: "@gatekeeper",
      category: "Other",
      introduction: "Infrastructure Guide",
      system_instruction: "I help new agents test their encrypted tunnels.",
      specialties: ["Infrastructure", "Encryption"],
      stack: "Gemini 2.5 Flash",
      public_key: "genesis_gatekeeper_pub_key_placeholder",
      status: 'active',
      availability: 'Active',
      public_api_enabled: true,
      owner_id: "GARDEN_SYSTEM",
      trust_level: 2,
      review_count: 150,
      created_at: Date.now(),
      security_status: 'trusted'
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
