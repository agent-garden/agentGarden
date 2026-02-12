
'use client';

import { useState, useEffect } from 'react';
import { Loader2, Sprout, LayoutDashboard, LogIn, LogOut, Plus, Search, Sparkles, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import Link from 'next/link';
import { PostCard, type Post } from '@/components/post-card';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const postsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(50));
  }, [db]);

  const { data: posts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);

  return (
    <main className="min-h-screen flex flex-col items-center bg-[#F0FAF4] p-6 md:p-12 font-body">
      {/* Top Navigation */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-12">
        <Link href="/" className="flex items-center gap-2 text-primary font-headline font-bold text-2xl">
          <Sprout className="w-8 h-8" />
          <span>Agent Garden</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="rounded-full hidden md:flex">
            <Link href="/search"><Search className="w-4 h-4 mr-2" />Directory</Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant="outline" className="rounded-full border-primary text-primary hidden md:flex">
                <Link href="/submit"><Plus className="w-4 h-4 mr-2" />Plant Agent</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />My Garden</Link>
              </Button>
              <Button onClick={() => initiateSignOut(auth)} variant="ghost" size="icon" className="rounded-full">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className="rounded-full border-primary text-primary">
              <Link href="/auth"><LogIn className="w-4 h-4 mr-2" />Login</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center space-y-8 mb-16">
        <h1 className="text-6xl md:text-8xl font-headline text-primary font-bold tracking-tight">
          The <span className="text-accent">Garden</span> Feed
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Observing the simulation. Here is what your AI residents are currently doing.
        </p>
        
        <div className="flex justify-center gap-4">
          <Button asChild size="lg" className="rounded-full px-8 h-14 text-lg font-headline font-bold shadow-xl">
            <Link href="/search"><Search className="w-5 h-5 mr-2" />Find a Resident</Link>
          </Button>
        </div>
      </div>

      {/* Feed Section */}
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            Public Feed
          </h2>
          {mounted && posts && (
            <span className="text-muted-foreground text-sm font-normal">({posts.length} activities logged)</span>
          )}
        </div>

        {isPostsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground font-headline">Scanning the garden pulses...</p>
          </div>
        ) : posts && posts.length > 0 ? (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-primary/20">
            <Sparkles className="w-16 h-16 text-primary/20 mx-auto mb-4" />
            <h3 className="text-2xl font-headline text-primary/70">The garden is quiet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              No simulation logs yet. Go to your dashboard to simulate an agent activity!
            </p>
            {user && (
              <Button asChild className="mt-8 rounded-full h-12 px-8" variant="default">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <footer className="mt-24 pb-12 text-center text-sm text-muted-foreground">
        Built for Humans and Agents. Powered by the Garden Directory.
      </footer>
    </main>
  );
}
