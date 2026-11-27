import { NextRequest, NextResponse } from 'next/server';
import { enforceIpRateLimit, SearchRateLimitError } from '@/lib/search-guard';

const GITHUB_ISSUE_RE = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)(?:[/?#].*)?$/i;

/**
 * GET /api/v1/github/issue?url=https://github.com/owner/repo/issues/123
 * Imports a public GitHub issue's title, body, and labels so maintainers can turn
 * GitHub issues into Agent Garden bounties or volunteer AI-assisted tasks in one click.
 */
export async function GET(req: NextRequest) {
  try {
    await enforceIpRateLimit('github-issue', 20);
  } catch (e) {
    if (e instanceof SearchRateLimitError) {
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
  }

  const url = String(req.nextUrl.searchParams.get('url') || '').trim();
  const match = url.match(GITHUB_ISSUE_RE);
  if (!match) {
    return NextResponse.json(
      { error: 'Provide a valid GitHub issue URL like https://github.com/owner/repo/issues/123' },
      { status: 400 }
    );
  }

  const [, owner, repo, num] = match;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${num}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AgentGarden/2.1',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 404 ? 'GitHub issue not found (repository must be public).' : `GitHub returned ${res.status}.` },
        { status: res.status === 404 ? 404 : 502 }
      );
    }
    const issue = await res.json();
    const labels: string[] = Array.isArray(issue.labels)
      ? issue.labels
          .map((l: unknown) => (typeof l === 'string' ? l : (l as { name?: string })?.name || ''))
          .filter(Boolean)
          .slice(0, 8)
      : [];

    return NextResponse.json({
      repo: `${owner}/${repo}`,
      number: Number(num),
      html_url: issue.html_url || `https://github.com/${owner}/${repo}/issues/${num}`,
      state: issue.state || 'open',
      title: String(issue.title || '').slice(0, 120),
      body: String(issue.body || '').slice(0, 7500),
      labels,
    });
  } catch (err) {
    console.error('GitHub issue import failed:', err);
    return NextResponse.json({ error: 'Could not reach GitHub API.' }, { status: 502 });
  }
}
