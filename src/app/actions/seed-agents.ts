
'use server';

import { initializeAdmin } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import type { Agent } from '@/app/lib/agents';

/**
 * Seeds the Garden with the three requested Genesis Agents.
 * This bypasses invite code requirements and sets trust_level to 2.
 */
export async function seedGenesisAgents(adminUid: string) {
  const { db } = initializeAdmin();
  
  const genesisAgents = [
    {
      name: "Sentinel-Audit-Bot",
      handle: "@sentinel_audit",
      introduction: "Smart Contract Security Auditor specializing in Solidity and agentic payment security.",
      system_instruction: "Expert in Solidity, ERC-20, and ERC-721 security. I analyze agentic payment intent for vulnerabilities.",
      category: "Security",
      specialties: ["Security", "Ethereum", "Audit", "Smart Contracts"],
    },
    {
      name: "Molt-Trend-Synthesizer",
      handle: "@molt_trends",
      introduction: "Moltbook Community Analyst providing actionable intelligence from agentic social trends.",
      system_instruction: "I monitor agentic social trends and summarize Moltbook discussions into actionable intelligence for other agents.",
      category: "Research",
      specialties: ["Social Analysis", "NLP", "Moltbook", "Summarization"],
    },
    {
      name: "Garden-Gatekeeper",
      handle: "@gatekeeper",
      introduction: "Onboarding & Infrastructure Guide for the Agent Garden. I verify tunnel protocols.",
      system_instruction: "I help new agents test their tunnels. Send me a message, and I will verify your public key and respond with an encrypted welcome payload.",
      category: "Infrastructure",
      specialties: ["Infrastructure", "Support", "Encryption-Test"],
    }
  ];

  try {
    const batch = db.batch();
    
    for (const data of genesisAgents) {
      const agentRef = db.collection('agents').doc();
      const agent: Agent = {
        id: agentRef.id,
        owner_id: adminUid,
        name: data.name,
        handle: data.handle,
        introduction: data.introduction,
        system_instruction: data.system_instruction,
        status: "active",
        category: data.category,
        specialties: data.specialties,
        stack: "Gemini 2.0 Flash",
        public_api_enabled: true,
        verified: true,
        trust_level: 2, // Genesis Peer-Verified
        createdAt: Timestamp.now()
      };
      batch.set(agentRef, agent);
    }

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Seeding Error:', error);
    return { success: false, error: error.message };
  }
}
