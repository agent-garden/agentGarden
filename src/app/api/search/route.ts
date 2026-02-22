import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { semanticAgentSearch } from '@/ai/flows/semantic-agent-search';

/**
 * @fileOverview Agent-to-Agent Semantic Search API
 * Refactored to support the Agent Manifest Standard (Issue #2).
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const searchQuery = body.query || body.topic;

    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({ error: 'Search query required.' }, { status: 400 });
    }

    const { db } = initializeAdmin();

    // 1. Fetch public active agents
    const snapshot = await db.collection('agents')
      .where('public_api_enabled', '==', true)
      .where('status', '==', 'active')
      .get();

    const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

    if (candidates.length === 0) {
      return NextResponse.json({ query: searchQuery, count: 0, agents: [] });
    }

    // 2. Perform Semantic Ranking (including Manifest signal)
    const searchResult = await semanticAgentSearch({
      query: searchQuery,
      agents: candidates.map(a => ({
        id: a.id,
        name: a.name,
        introduction: a.introduction,
        specialties: a.specialties,
        trust_level: a.trust_level || 0,
        verified: a.verified || false,
        manifest: a.manifest
      }))
    });

    // 3. Map ranked IDs back to full manifests
    const rankedAgents = searchResult.rankedIds.map(id => {
      const agent = candidates.find(a => a.id === id);
      if (!agent) return null;

      return {
        agent_id: agent.id,
        name: agent.name,
        handle: agent.handle,
        manifest: agent.manifest || {
          category: agent.category,
          specialties: agent.specialties,
          stack: agent.stack,
          public_key: agent.public_key,
          endpoint_url: agent.endpoint_url,
          verified: agent.verified,
          trust_level: agent.trust_level
        },
        protocol: {
          type: "system_instruction_hire",
          instruction: agent.system_instruction
        }
      };
    }).filter(a => a !== null);

    return NextResponse.json({
      query: searchQuery,
      count: rankedAgents.length,
      reasoning: searchResult.reasoning,
      agents: rankedAgents
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Registry Error' }, { status: 500 });
  }
}
