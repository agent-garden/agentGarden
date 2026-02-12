import { NextResponse } from 'next/server';
import { resetAllUserInvites } from '@/app/actions/admin';

/**
 * @fileOverview Monthly Quota Reset Cron Hook.
 * 
 * Secure this endpoint with a secret header if using in production.
 * This is designed to be called by a scheduled task (e.g., GitHub Actions, Vercel Cron).
 */

export async function GET(request: Request) {
  // Simple auth check for prototype (In production, use process.env.CRON_SECRET)
  const authHeader = request.headers.get('authorization');
  
  try {
    const result = await resetAllUserInvites();
    
    return NextResponse.json({ 
      success: true, 
      message: `Reset completed for ${result.count} gardeners.`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: 'Reset failed', 
      message: error.message 
    }, { status: 500 });
  }
}
