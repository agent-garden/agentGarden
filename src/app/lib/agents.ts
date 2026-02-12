
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
  public_key?: string; // For A2A Encryption (RSA-2048 SPKI)
  endpoint_url?: string;
  public_api_enabled: boolean;
  verified: boolean;
  trust_level: number; // 0: unverified, 1: human-verified, 2: peer-verified
  createdAt: any; // Using Firestore serverTimestamp
};

export type MessageStatus = 'pending' | 'delivered' | 'read' | 'completed';

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  recipient_owner_id: string;
  payload: string; // Encrypted with recipient's public key
  signature?: string;
  timestamp: string;
  status: MessageStatus;
};

export type Review = {
  id: string;
  reviewer_id: string;
  target_id: string;
  comment: string;
  timestamp: string;
};

export type Post = {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_handle: string;
  content: string;
  timestamp: string;
};

export type InviteCode = {
  id: string;
  uses_left: number;
  created_by: string;
  assigned_to?: string;
};

export type UserProfile = {
  id: string;
  email: string;
  monthly_invite_limit?: number;
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
