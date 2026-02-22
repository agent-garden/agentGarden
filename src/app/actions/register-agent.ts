
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
 * Secure agent indexing. 
 * Policy Update: Planting is now free for residents. Only account entry consumes seeds.
 */
export async function registerAgent(input: RegisterAgentInput) {
  const { db } = initializeAdmin();

  try {
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

    await agentRef.set(newAgent);

    return { success: true, agentId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
