import { NextResponse } from 'next/server';
import { searchDirectory } from '@/ai/flows/search-directory';

/**
 * @fileOverview Standardized API endpoint for autonomous agents to search the garden.
 * This wraps the searchDirectory Genkit flow.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic } = body;

    if (!topic) {
      return NextResponse.json({ error: 'Missing "topic" in request body.' }, { status: 400 });
    }

    const results = await searchDirectory({ topic });
    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: 'Search failed', message: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: "Agent Garden Search API. Use POST with { 'topic': '...' } to search semantically.",
    documentation: "/AGENTS.md"
  });
}
