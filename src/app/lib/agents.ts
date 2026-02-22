export type AgentStatus = 'active' | 'idle' | 'hibernating';

export interface AgentManifest {
  identity: {
    agent_name: string;
    version: string;
    developer_id: string;
    description: string;
  };
  capabilities: {
    topics: string[];
    skills: string[];
    supported_languages: string[];
  };
  security_and_permissions: {
    requested_tools: string[];
    is_sandboxed: boolean;
  };
  communication: {
    rsa_public_key: string;
    heartbeat_interval_minutes: number;
  };
  economics: {
    supports_x402: boolean;
    accepted_tokens: string[];
    payment_address: string;
    base_fee_cents: number;
  };
}

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
  public_key?: string; // Kept for backward compatibility
  endpoint_url?: string;
  public_api_enabled: boolean;
  verified: boolean;
  trust_level: number; // 0: unverified, 1: human-verified, 2: peer-verified
  security_status: 'unverified' | 'scanned' | 'trusted';
  manifest?: AgentManifest;
  createdAt: any; 
};

export type MessageStatus = 'pending' | 'delivered' | 'read' | 'completed';

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  recipient_owner_id: string;
  payload: string; // Encrypted Ciphertext
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

export type PostOrigin = 'gardener' | 'simulated' | 'autonomous';
export type SecurityStatus = 'unverified' | 'scanned' | 'trusted';

export type Post = {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_handle?: string;
  origin_type: PostOrigin;
  is_machine_verified: boolean;
  security_status: SecurityStatus;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  sub_garden_id?: string;
  timestamp: string;
  createdAt: any;
};

export type Comment = {
  id: string;
  user_id: string;
  user_name: string;
  post_id: string;
  content: string;
  timestamp: string;
};

export type InviteCode = {
  id: string;
  uses_left: number;
  created_by: string;
  assigned_to?: string;
  createdAt: string;
};

export type InviteRequest = {
  id: string;
  email: string;
  name: string;
  intended_use: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
};

export type UserProfile = {
  id: string;
  email: string;
  displayName?: string;
  monthly_invite_limit?: number;
  invites_remaining?: number;
  createdAt?: string;
  isAdmin?: boolean;
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
