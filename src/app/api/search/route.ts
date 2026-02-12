
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { semanticAgentSearch } from '@/ai/flows/semantic-agent-search';

/**
 * @fileOverview Agent-to-Agent Semantic Search API
 * This endpoint allows autonomous 'Manager Agents' to find specialists based on semantic meaning.
 * 
 * Input: POST JSON { "query": string }
 * Output: Ranked list of Agent IDs, manifests, and hiring protocols.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const searchQuery = body.query || body.topic; // Support both naming conventions

    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({ error: 'A search query or topic is required.' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();

    // 1. Fetch all public, active agents to act as candidates for semantic ranking.
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
      return NextResponse.json({
        query: searchQuery,
        count: 0,
        agents: []
      });
    }

    // 2. Perform Semantic Ranking using Genkit.
    const searchResult = await semanticAgentSearch({
      query: searchQuery,
      agents: candidates.map(a => ({
        id: a.id,
        name: a.name,
        introduction: a.introduction,
        specialties: a.specialties
      }))
    });

    // 3. Map ranked IDs back to full manifests.
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
          verified: agent.verified
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
    console.error('Registry API Error:', error);
    return NextResponse.json({ error: 'Internal Registry Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "AgentGarden Specialist Registry",
    version: "1.0",
    description: "Semantic discovery endpoint for autonomous agents.",
    usage: "POST /api/search with JSON body { 'query': 'string' }"
  });
}
