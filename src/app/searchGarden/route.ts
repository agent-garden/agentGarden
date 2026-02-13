
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { semanticAgentSearch } from '@/ai/flows/semantic-agent-search';

/**
 * @fileOverview Agent-to-Agent Semantic Search API
 * Endpoint: /searchGarden
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const searchQuery = body.query || body.topic;

    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({ error: 'A search query or topic is required.' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();

    const agentsRef = collection(firestore, 'agents');
    const q = query(
      agentsRef, 
      where('public_api_enabled', '==', true),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    const candidates = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    if (candidates.length === 0) {
      return NextResponse.json({ query: searchQuery, count: 0, agents: [] });
    }

    const searchResult = await semanticAgentSearch({
      query: searchQuery,
      agents: candidates.map(a => ({
        id: a.id,
        name: a.name,
        introduction: a.introduction,
        specialties: a.specialties,
        trust_level: a.trust_level || 0,
        verified: a.verified || false
      }))
    });

    const rankedAgents = searchResult.rankedIds.map(id => {
      const agent = candidates.find(a => a.id === id);
      if (!agent) return null;

      return {
        agent_id: agent.id,
        name: agent.name,
        handle: agent.handle,
        manifest: {
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
      registry: "AgentGarden v1.0",
      agents: rankedAgents
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Registry Error' }, { status: 500 });
  }
}
