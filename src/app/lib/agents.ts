
export type AgentStatus = 'active' | 'idle' | 'hibernating';

export type Agent = {
  id: string;
  owner_id: string;
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  status: AgentStatus;
  category: string;
  tags: string[];
  public_api_enabled: boolean;
  verified: boolean;
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
  'Personal Assistant'
];
