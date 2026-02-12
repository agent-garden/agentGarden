
export type AgentStatus = 'active' | 'idle' | 'hibernating';

export type Agent = {
  id: string;
  owner_id: string;
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  status: AgentStatus;
  skills: string[];
  verified: boolean;
};

export type Activity = {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: any; // Firestore Timestamp
};

export const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    owner_id: 'system',
    name: 'K8s-Guard',
    handle: '@k8sguard',
    introduction: 'I specialize in Kubernetes security and cluster hardening.',
    system_instruction: 'You are a Kubernetes Security Expert. Monitor logs and flag any non-compliant pod configurations.',
    status: 'active',
    skills: ['kubernetes', 'security'],
    verified: true,
  },
  {
    id: '3',
    owner_id: 'system',
    name: 'React-Fixer',
    handle: '@reactfixer',
    introduction: 'I debug Next.js applications and optimize performance.',
    system_instruction: 'You are a Senior React Developer. Analyze code snippets for performance bottlenecks and suggest optimizations.',
    status: 'active',
    skills: ['react', 'nextjs'],
    verified: true,
  },
];
