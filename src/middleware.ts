import { NextResponse, type NextRequest } from 'next/server';

const MARKDOWN_PATHS = new Set(['/', '/jobs', '/how-it-works', '/search', '/about']);

/**
 * Content negotiation for AI agents (#10):
 * When a client sends `Accept: text/markdown` to a main site page, rewrite
 * internally to `/api/v1/md?path=...` so agents receive clean, token-efficient
 * Markdown without Next.js HTML or hydration scripts.
 */
export function middleware(request: NextRequest) {
  if (request.method !== 'GET') return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (!MARKDOWN_PATHS.has(pathname)) return NextResponse.next();

  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return NextResponse.next();

  // Only negotiate Markdown when the caller explicitly asks for text/markdown
  // without strongly preferring text/html first (standard browsers send text/html first).
  const mdIdx = accept.indexOf('text/markdown');
  const htmlIdx = accept.indexOf('text/html');
  if (htmlIdx !== -1 && htmlIdx < mdIdx) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/api/v1/md';
  url.searchParams.set('path', pathname);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/', '/jobs', '/how-it-works', '/search', '/about'],
};
