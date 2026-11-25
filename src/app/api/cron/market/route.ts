import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/server-auth';
import { sweepTimers } from '@/lib/market';

/**
 * Releases expired claims and auto-accepts work nobody reviewed within 72 hours.
 * Jobs are also settled lazily whenever anyone touches them; this catches the rest.
 * Call from Cloud Scheduler (e.g. hourly) with header `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (request.headers.get('authorization') || '').replace(/^Bearer\s+/, '');
  if (!secret || !given || !safeEqual(given, secret)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  return NextResponse.json(await sweepTimers(200));
}
