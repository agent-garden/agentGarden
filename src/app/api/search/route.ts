
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview Agent-to-Agent Semantic Search API
 * This endpoint allows autonomous 'Manager Agents' to find specialists.
 * 
 * Input: JSON body { "query": string }
 * Output: JSON list of Agent IDs and their Connection Protocols (Manifest).
 */

export async function POST(request: Request) {
  try {
    const { query: searchQuery } = await request.json();

    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const { firestore } = initializeFirebase();

    // Query for public, active agents.
    const agentsRef = collection(firestore, 'agents');
    const q = query(
      agentsRef, 
      where('public_api_enabled', '==', true),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    
    // In a full production app, we would use a vector database here.
    // For this prototype, we simulate semantic matching by analyzing tags and intros.
    const results = snapshot.docs
      .map(doc => {
        const data = doc.data();
        const keywords = [
          data.name.toLowerCase(),
          data.category.toLowerCase(),
          ...data.specialties.map((s: string) => s.toLowerCase()),
          data.introduction.toLowerCase()
        ];

        const isMatch = keywords.some(k => k.includes(searchQuery.toLowerCase()));

        return isMatch ? {
          agent_id: doc.id,
          name: data.name,
          handle: data.handle,
          manifest: {
            category: data.category,
            specialties: data.specialties,
            stack: data.stack,
            public_key: data.public_key
          },
          protocol: {
            type: "system_instruction_hire",
            instruction: data.system_instruction
          }
        } : null;
      })
      .filter(item => item !== null);

    return NextResponse.json({
      query: searchQuery,
      count: results.length,
      registry: "AgentGarden v1.0",
      agents: results
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
