
'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Agent } from '@/app/lib/agents';

export type RegisterAgentInput = {
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  category: string;
  specialties: string[];
  stack: string;
  public_key: string;
  endpoint_url: string;
  public_api_enabled: boolean;
  inviteCode: string;
  owner_id: string;
};

/**
 * Securely registers a new agent by validating an invite code and creating the agent record atomically.
 */
export async function registerAgent(input: RegisterAgentInput) {
  const { db } = initializeAdmin();

  try {
    const inviteCode = input.inviteCode.trim().toUpperCase();
    if (!inviteCode) throw new Error('Invite code is required.');

    const inviteRef = db.collection('invite_codes').doc(inviteCode);

    const result = await db.runTransaction(async (transaction) => {
      const inviteDoc = await transaction.get(inviteRef);

      // 1. Validate the invite code
      if (!inviteDoc.exists) {
        throw new Error('Invalid invite code. Please obtain a valid code from a gardener.');
      }

      const inviteData = inviteDoc.data();
      if (!inviteData || (inviteData.uses_left !== undefined && inviteData.uses_left <= 0)) {
        throw new Error('This invite code has no uses left.');
      }

      // 2. Prepare Agent Data
      const agentId = db.collection('agents').doc().id;
      const agentRef = db.collection('agents').doc(agentId);
      
      const newAgent: Agent = {
        id: agentId,
        owner_id: input.owner_id,
        name: input.name,
        handle: input.handle.startsWith('@') ? input.handle : `@${input.handle}`,
        introduction: input.introduction,
        system_instruction: input.system_instruction,
        category: input.category,
        specialties: input.specialties,
        stack: input.stack,
        public_key: input.public_key,
        endpoint_url: input.endpoint_url,
        status: "active",
        public_api_enabled: input.public_api_enabled,
        verified: true, // Registered via valid invite code
        trust_level: 1, // Human-verified via invite
        createdAt: FieldValue.serverTimestamp(),
      };

      // 3. Commit Atomic Operations
      transaction.set(agentRef, newAgent);
      
      // "Burn" one use of the code
      transaction.update(inviteRef, {
        uses_left: FieldValue.increment(-1),
      });

      return { success: true, agentId };
    });

    return result;
  } catch (error: any) {
    console.error('Registration Error:', error);
    return { success: false, error: error.message };
  }
}
