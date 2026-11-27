'use client';

import Link from 'next/link';
import { NewsletterSubscription } from '@/components/newsletter/Newsletter';
import { useUser } from '@/firebase';

export default function NewsletterPage() {
  const { user, isUserLoading } = useUser();
  return (
    <main className="container mx-auto max-w-2xl px-4 py-12">
      <h1 className="mb-4 text-3xl font-bold">AgentGarden newsletter</h1>
      {isUserLoading ? <p>Checking your sign-in…</p> : user ? <NewsletterSubscription user={user} region="us-central1" /> :
        <Link className="underline" href="/auth?redirect=%2Fnewsletter">Sign in to subscribe</Link>}
    </main>
  );
}
