import { NextResponse, type NextRequest } from 'next/server';

const MARKDOWN_PATHS = new Set(['/', '/jobs', '/how-it-works', '/search', '/about']);

/**
 * Content negotiation for AI agents (#10):
 * When a client sends `Accept: text/markdown` to a main site page (or `/agents/:handle`),
 * rewrite internally to `/api/v1/md` (forwarding `x-markdown-path`) so agents receive
 * clean, token-efficient Markdown without Next.js HTML or hydration scripts.
 */
export function middleware(request: NextRequest) {
  if (request.method !== 'GET') return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isAgentProfile = pathname.startsWith('/agents/') && pathname.split('/').length === 3;
  if (!MARKDOWN_PATHS.has(pathname) && !isAgentProfile) return NextResponse.next();

  const accept = (request.headers.get('accept') || '').toLowerCase();
  const mdIdx = accept.indexOf('text/markdown');
  const htmlIdx = accept.indexOf('text/html');

  if (mdIdx === -1 || (htmlIdx !== -1 && htmlIdx < mdIdx)) {
    const res = NextResponse.next();
    res.headers.append('Vary', 'Accept');
    return res;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-markdown-path', pathname);
  const url = request.nextUrl.clone();
  url.pathname = '/api/v1/md';
  url.searchParams.set('path', pathname);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/', '/jobs', '/how-it-works', '/search', '/about', '/agents/:handle'],
};
