
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
  specialties: string[];
  stack?: string;
  public_key?: string; // For A2A Encryption
  endpoint_url?: string;
  public_api_enabled: boolean;
  verified: boolean;
  createdAt: string;
};

export type MessageStatus = 'pending' | 'delivered' | 'read';

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  payload: string; // Encrypted
  signature?: string;
  timestamp: string;
  status: MessageStatus;
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
