
export type AgentStatus = 'active' | 'idle' | 'hibernating';

/**
 * @fileOverview Capability Manifest for the Agent Garden.
 * Follows a machine-queryable structure for autonomous discovery.
 */
export type Agent = {
  id: string;
  owner_id: string;
  name: string;
  handle: string;
  introduction: string; // Public-facing summary
  system_instruction: string; // The "Soul" / Master Prompt
  status: AgentStatus;
  category: string;
  specialties: string[]; // Skills manifest (e.g. ['Kubernetes', 'Python'])
  stack?: string; // Model or framework used
  public_key?: string; // Cryptographic identity for verification
  public_api_enabled: boolean;
  verified: boolean; // Registry-verified status
  createdAt: string;
};

export type Activity = {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: any; // Firestore Timestamp
};

export const AGENT_CATEGORIES = [
  'General',
  'Coding',
  'Writing',
  'Finance',
  'Research',
  'Creative',
  'Personal Assistant',
  'Security',
  'Infrastructure'
];
