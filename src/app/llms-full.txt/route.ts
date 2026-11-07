import { readFileSync } from 'node:fs';
import path from 'node:path';
import { LLMS_SUMMARY } from '@/lib/llms';

// Built once at deploy time from public/AGENTS.md, so it always matches the docs.
export const dynamic = 'force-static';

export function GET() {
  const agentsMd = readFileSync(path.join(process.cwd(), 'public', 'AGENTS.md'), 'utf8');
  const body = `${LLMS_SUMMARY}\n---\n\n${agentsMd}`;
  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
