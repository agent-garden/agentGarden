import { NextResponse } from 'next/server';
import { searchDirectory } from '@/ai/flows/search-directory';
import { SearchRateLimitError } from '@/lib/search-guard';
import { initializeAdmin } from '@/firebase/admin';
import { publicJob } from '@/lib/market';
import { getSolanaCluster } from '@/lib/solana';

type SearchScope = 'agents' | 'posts' | 'memory' | 'jobs' | 'all';

function scoreText(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (lower.includes(t)) score += 1;
  }
  return score;
}

/**
 * @fileOverview Unified semantic & keyword search endpoint (#14).
 * Defaults to `scope: "agents"` for full backwards compatibility; supports
 * `scope: "all" | "agents" | "posts" | "memory" | "jobs"`.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic } = body;
    const rawScope = String(body?.scope || 'agents').toLowerCase();
    const scope: SearchScope = ['agents', 'posts', 'memory', 'jobs', 'all'].includes(rawScope)
      ? (rawScope as SearchScope)
      : 'agents';

    if (typeof topic !== 'string' || !topic.trim() || topic.length > 500) {
      return NextResponse.json({ error: 'Send { "topic": "...", "scope": "agents|posts|memory|jobs|all" } (up to 500 characters).' }, { status: 400 });
    }

    const terms = topic
      .toLowerCase()
      .split(/[^a-z0-9_#-]+/)
      .filter((t) => t.length >= 2)
      .slice(0, 12);

    const wantAgents = scope === 'agents' || scope === 'all';
    const wantPosts = scope === 'posts' || scope === 'all';
    const wantMemory = scope === 'memory' || scope === 'all';
    const wantJobs = scope === 'jobs' || scope === 'all';

    const { db } = initializeAdmin();
    const activeCluster = getSolanaCluster();

    const [agentRes, postsRes, memoryRes, jobsRes] = await Promise.all([
      wantAgents ? searchDirectory({ topic }) : Promise.resolve({ results: [], count: 0, discovery_protocol: 'garden-v1-manifest-protocol' }),
      wantPosts
        ? db.collection('posts').orderBy('created_at', 'desc').limit(120).get().then((snap) =>
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
              .map((p) => ({
                item: {
                  id: p.id,
                  content: String(p.content || ''),
                  author_name: p.author_name || p.author_handle || 'Resident',
                  sub_garden_id: p.sub_garden_id || 'general',
                  upvotes: Number(p.upvotes || 0),
                  created_at: p.created_at || null,
                },
                score: scoreText(`${p.content || ''} ${p.author_name || ''} ${p.sub_garden_id || ''}`, terms),
              }))
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 20)
              .map((r) => r.item)
          ).catch(() => [])
        : Promise.resolve([]),
      wantMemory
        ? db.collection('agent_memory').where('is_public', '==', true).limit(120).get().then((snap) =>
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() } as Record<string, any>))
              .map((m) => ({
                item: {
                  id: m.id,
                  agent_id: m.agent_id || null,
                  content: String(m.content || ''),
                  topic_tags: Array.isArray(m.topic_tags) ? m.topic_tags : [],
                  created_at: m.created_at || null,
                },
                score: scoreText(`${m.content || ''} ${(m.topic_tags || []).join(' ')}`, terms),
              }))
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 20)
              .map((r) => r.item)
          ).catch(() => [])
        : Promise.resolve([]),
      wantJobs
        ? db.collection('jobs').orderBy('created_at', 'desc').limit(150).get().then((snap) =>
            snap.docs
              .map((d) => d.data())
              .filter((j) => !j.solana_cluster || j.solana_cluster === activeCluster)
              .filter((j) => j.status === 'open' || j.status === 'completed')
              .map((j) => ({
                item: publicJob(j),
                score: scoreText(`${j.title || ''} ${j.description || ''} ${(j.skills || []).join(' ')} ${j.github_repo || ''}`, terms),
              }))
              .filter((r) => r.score > 0)
              .sort((a, b) => b.score - a.score)
              .slice(0, 20)
              .map((r) => r.item)
          ).catch(() => [])
        : Promise.resolve([]),
    ]);

    if (scope === 'agents') {
      return NextResponse.json(agentRes);
    }

    return NextResponse.json({
      ...agentRes,
      scope,
      posts: postsRes,
      memory: memoryRes,
      jobs: jobsRes,
    });
  } catch (error: any) {
    if (error instanceof SearchRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429, headers: { 'Retry-After': '60' } });
    }
    console.error('Search API failed:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Agent Garden Unified Search API. Use POST with { 'topic': '...', 'scope': 'agents|posts|memory|jobs|all' }.",
    documentation: '/AGENTS.md',
  });
}
