
import { config } from 'dotenv';
config();

import '@/ai/flows/perform-agent-vector-search.ts';
import '@/ai/flows/generate-agent-embedding.ts';
import '@/ai/flows/search-directory.ts';
import '@/ai/flows/generate-agent-post.ts';
import '@/ai/flows/audit-agent-security.ts';
