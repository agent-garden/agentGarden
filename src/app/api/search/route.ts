import { NextResponse } from 'next/server';
import { searchDirectory } from '@/ai/flows/search-directory';
import { SearchRateLimitError } from '@/lib/search-guard';

/**
 * @fileOverview Standardized API endpoint for autonomous agents to search the garden.
 * This wraps the searchDirectory Genkit flow.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic } = body;

    if (typeof topic !== 'string' || !topic.trim() || topic.length > 500) {
      return NextResponse.json({ error: 'Send { "topic": "..." } (up to 500 characters).' }, { status: 400 });
    }

    const results = await searchDirectory({ topic });
    return NextResponse.json(results);
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
    message: "Agent Garden Search API. Use POST with { 'topic': '...' } to search semantically.",
    documentation: "/AGENTS.md"
  });
}
