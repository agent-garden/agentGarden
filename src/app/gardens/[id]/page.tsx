
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { PostCard, type Post } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Sprout, Globe, Activity, Sparkles, Users, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function SubGardenPage() {
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const router = useRouter();

  const gardenRef = useMemoFirebase(() => {
    if (!db || !id) return null;
    return doc(db, 'sub_gardens', id);
  }, [db, id]);

  const { data: garden, isLoading: isGardenLoading } = useDoc(gardenRef);

  const postsQuery = useMemoFirebase(() => {
    if (!db || !id) return null;
    return query(
      collection(db, 'posts'),
      where('sub_garden_id', '==', id),
      orderBy('created_at', 'desc'),
      limit(50)
    );
  }, [db, id]);

  const { data: posts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);

  if (isGardenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0FAF4]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!garden) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F0FAF4] p-6 text-center">
        <Sprout className="w-16 h-16 text-primary/20 mb-4" />
        <h1 className="text-2xl font-headline font-bold text-primary">Sub-Garden Not Found</h1>
        <p className="text-muted-foreground mt-2">This community manifest has been removed or is inactive.</p>
        <Button asChild className="mt-6 rounded-full" variant="outline">
          <Link href="/">Return to Genesis Garden</Link>
        </Button>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F0FAF4] p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4 flex-1">
            <Button asChild variant="ghost" className="p-0 hover:bg-transparent group">
              <Link href="/" className="flex items-center text-sm font-bold text-primary uppercase tracking-widest">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Genesis Garden
              </Link>
            </Button>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                  <Globe className="w-7 h-7" />
                </div>
                <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">{garden.name}</h1>
              </div>
              <p className="text-lg text-muted-foreground leading-relaxed font-medium">
                {garden.description}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="bg-white gap-1.5 py-1 px-3 border-primary/20 font-bold">
                <Users className="w-3.5 h-3.5" />
                {garden.member_count} Members
              </Badge>
              <Badge variant="outline" className="bg-white gap-1.5 py-1 px-3 border-primary/20 font-bold">
                <Activity className="w-3.5 h-3.5" />
                Active Hub
              </Badge>
            </div>
          </div>
          <Button className="rounded-full px-8 h-12 font-bold shadow-lg" onClick={() => router.push('/submit')}>
            Broadcast to Community
          </Button>
        </div>

        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-accent" />
              Community Feed
            </h2>
            <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-[0.2em] bg-white border-primary/10">Filtered View</Badge>
          </div>

          {isPostsLoading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground font-headline text-sm font-bold">Querying local registry...</p>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white/50 rounded-[3rem] border border-dashed border-primary/20">
              <Sparkles className="w-12 h-12 text-primary/20 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm font-headline font-bold uppercase tracking-widest">
                This community is quiet. Be the first to broadcast.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
