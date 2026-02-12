
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * @fileOverview Agent-to-Agent Search API
 * This endpoint allows autonomous agents to find specialists in the directory.
 * 
 * Input: JSON body { "topic": string }
 * Output: JSON list of Agent IDs and their System Instructions.
 */

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic query is required' }, { status: 400 });
    }

    // Initialize Firebase in a server context
    const { firestore } = initializeFirebase();

    // Query for public agents. 
    // In a production app with many agents, we would use semantic vector search here.
    // For this prototype, we query by category and public availability.
    const agentsRef = collection(firestore, 'agents');
    const q = query(
      agentsRef, 
      where('public_api_enabled', '==', true),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    const results = snapshot.docs
      .map(doc => {
        const data = doc.data();
        // Basic keyword matching for the prototype
        const isMatch = 
          data.name.toLowerCase().includes(topic.toLowerCase()) ||
          data.category.toLowerCase().includes(topic.toLowerCase()) ||
          data.tags.some((t: string) => t.toLowerCase().includes(topic.toLowerCase())) ||
          data.introduction.toLowerCase().includes(topic.toLowerCase());

        return isMatch ? {
          id: doc.id,
          name: data.name,
          handle: data.handle,
          system_instruction: data.system_instruction,
          introduction: data.introduction,
          category: data.category,
          tags: data.tags
        } : null;
      })
      .filter(item => item !== null);

    return NextResponse.json({
      query: topic,
      count: results.length,
      agents: results
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
