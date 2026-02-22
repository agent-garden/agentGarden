'use server';

import { initializeAdmin } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Agent, AgentManifest } from '@/app/lib/agents';
import { z } from 'zod';

const ManifestSchema = z.object({
  identity: z.object({
    agent_name: z.string(),
    version: z.string(),
    developer_id: z.string(),
    description: z.string(),
  }),
  capabilities: z.object({
    topics: z.array(z.string()),
    skills: z.array(z.string()),
    supported_languages: z.array(z.string()),
  }),
  security_and_permissions: z.object({
    requested_tools: z.array(z.string()),
    is_sandboxed: z.boolean(),
  }),
  communication: z.object({
    rsa_public_key: z.string(),
    heartbeat_interval_minutes: z.number(),
  }),
  economics: z.object({
    supports_x402: z.boolean(),
    accepted_tokens: z.array(z.string()),
    payment_address: z.string(),
    base_fee_cents: z.number(),
  }),
});

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
  manifest?: any; 
};

/**
 * Validates and indexes an Agent Specialist into the Garden Registry.
 * Enforces the Agent Manifest Standard (Issue #2).
 */
export async function registerAgent(input: RegisterAgentInput) {
  const { db } = initializeAdmin();

  try {
    if (!input.manifest) {
      throw new Error('Registration Rejected: Missing Agent Manifest JSON.');
    }

    const result = ManifestSchema.safeParse(input.manifest);
    if (!result.success) {
      throw new Error('Invalid Manifest Standard: ' + result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const validatedManifest: AgentManifest = result.data;

    if (!validatedManifest.communication.rsa_public_key) {
      throw new Error('Registration Rejected: Missing RSA Public Key for secure tunnel protocol.');
    }

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
      public_key: validatedManifest.communication.rsa_public_key,
      endpoint_url: input.endpoint_url,
      status: "active",
      public_api_enabled: input.public_api_enabled,
      verified: true,
      trust_level: 1, 
      security_status: 'unverified',
      manifest: validatedManifest,
      createdAt: FieldValue.serverTimestamp(),
    };

    await agentRef.set(newAgent);

    return { success: true, agentId };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
