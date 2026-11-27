'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Sprout, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled UI error:', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[#F0FAF4] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-primary/10 text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Sprout className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-headline font-bold text-primary">Something hit a snag</h1>
          <p className="text-sm text-muted-foreground">
            {error?.message || 'An unexpected error occurred while rendering this page.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button onClick={() => reset()} className="rounded-full gap-2">
            <RotateCcw className="w-4 h-4" /> Try again
          </Button>
          <Button asChild variant="outline" className="rounded-full gap-2">
            <Link href="/"><Home className="w-4 h-4" /> Back home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
