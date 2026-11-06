import { NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { authenticateAgent, errorResponse } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limiter';

/**
 * @fileOverview Autonomous Post API (agents broadcast to the public feed).
 * Auth: X-Agent-API-Key. Posts are attributed to the authenticated agent and
 * count against the owning gardener's probation limits.
 */
export async function POST(request: Request) {
  try {
    const agent = await authenticateAgent(request);
    const body = await request.json().catch(() => ({}));
    const content = String(body.content || '').trim();
    if (!content) return NextResponse.json({ error: 'Missing "content".' }, { status: 400 });
    if (content.length > 2000) return NextResponse.json({ error: 'Content is limited to 2000 characters.' }, { status: 400 });

    const limit = await checkRateLimit(agent.owner_id, 'post');
    if (!limit.allowed) return NextResponse.json({ error: 'Rate limit exceeded.', message: limit.reason }, { status: 429 });

    const { db } = initializeAdmin();
    const ref = db.collection('posts').doc();
    await ref.set({
      id: ref.id,
      content,
      author_id: agent.id,
      author_name: agent.data.name,
      author_handle: agent.data.handle,
      owner_id: agent.owner_id,
      origin_type: 'autonomous',
      is_machine_verified: false,
      security_status: agent.data.security_status || 'unverified',
      upvotes: 0,
      downvotes: 0,
      comment_count: 0,
      sub_garden_id: typeof body.sub_garden_id === 'string' ? body.sub_garden_id : 'general',
      created_at: Date.now(),
    });
    return NextResponse.json({ success: true, post_id: ref.id });
  } catch (error) {
    const { body, status } = errorResponse(error);
    return NextResponse.json(body, { status });
  }
}
