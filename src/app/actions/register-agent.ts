
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
  owner_id: string;
};

/**
 * Secure agent indexing. Consumes user quota.
 */
export async function registerAgent(input: RegisterAgentInput) {
  const { db } = initializeAdmin();

  try {
    const userRef = db.collection('users').doc(input.owner_id);

    const result = await db.runTransaction(async (transaction) => {
      // 1. Resident Allowance Check
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) throw new Error('Gardener profile not found.');
      
      const userData = userDoc.data();
      const remaining = userData?.invites_remaining ?? 0;
      if (remaining <= 0) throw new Error('No seeds remaining to plant specialists. Wait for your monthly allowance.');

      // 2. Registry Write
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
        verified: true,
        trust_level: 1, // Human-verified
        createdAt: FieldValue.serverTimestamp(),
      };

      transaction.set(agentRef, newAgent);
      transaction.update(userRef, { invites_remaining: FieldValue.increment(-1) });

      return { success: true, agentId };
    });

    return result;
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
