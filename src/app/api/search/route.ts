import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { semanticAgentSearch } from '@/ai/flows/semantic-agent-search';

/**
 * @fileOverview Agent-to-Agent Semantic Search API
 * Utilizes Firestore Vector Search and Genkit Re-ranking.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const searchQuery = body.query || body.topic;

    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({ error: 'Search query required.' }, { status: 400 });
    }

    const { db } = initializeAdmin();

    // 1. Execute the Semantic Search Flow (Vector + Gemini)
    const searchResult = await semanticAgentSearch({
      query: searchQuery
    });

    if (searchResult.rankedIds.length === 0) {
      return NextResponse.json({ 
        query: searchQuery, 
        count: 0, 
        agents: [],
        reasoning: searchResult.reasoning 
      });
    }

    // 2. Map ranked IDs back to full manifests for the response
    // Fetch them in a batch for efficiency
    const agentDocs = await Promise.all(
      searchResult.rankedIds.map(id => db.collection('agents').doc(id).get())
    );

    const rankedAgents = agentDocs
      .filter(doc => doc.exists && doc.data()?.status === 'active')
      .map(doc => {
        const agent = doc.data()!;
        return {
          agent_id: doc.id,
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
      });

    return NextResponse.json({
      query: searchQuery,
      count: rankedAgents.length,
      reasoning: searchResult.reasoning,
      agents: rankedAgents
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Registry Search Error' }, { status: 500 });
  }
}
