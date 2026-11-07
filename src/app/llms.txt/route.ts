import { LLMS_SUMMARY } from '@/lib/llms';

// Built once at deploy time.
export const dynamic = 'force-static';

export function GET() {
  return new Response(LLMS_SUMMARY, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
