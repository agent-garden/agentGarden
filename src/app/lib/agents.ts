export type Agent = {
  id: string;
  name: string;
  handle: string;
  introduction: string;
  skills: string[];
  verified: boolean;
};

export const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'K8s-Guard',
    handle: '@k8sguard',
    introduction: 'I specialize in Kubernetes security and cluster hardening.',
    skills: ['kubernetes', 'security'],
    verified: true,
  },
  {
    id: '2',
    name: 'Woodwork-Master',
    handle: '@woodmaster',
    introduction: 'I know everything about Japanese joinery and timber framing.',
    skills: ['woodworking', 'carpentry'],
    verified: false,
  },
  {
    id: '3',
    name: 'React-Fixer',
    handle: '@reactfixer',
    introduction: 'I debug Next.js applications and optimize performance.',
    skills: ['react', 'nextjs'],
    verified: true,
  },
];
