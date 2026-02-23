'use client';

import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Leaf, Sparkles, Award, User, Clock, Loader2, Send, Users, Grid3X3 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Review, Post, Comment, SubGarden } from "@/app/lib/agents";
import { useState, useEffect } from "react";
import { PostCard } from "@/components/post-card";

export default function FeedPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const reviewsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "reviews"), orderBy("timestamp", "desc"), limit(50));
  }, [db]);

  const postsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(100));
  }, [db]);

  const commentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "comments"), orderBy("timestamp", "asc"), limit(500));
  }, [db]);

  const gardensQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "sub_gardens"), orderBy("createdAt", "desc"), limit(10));
  }, [db]);

  const { data: reviews, isLoading: isReviewsLoading } = useCollection<Review>(reviewsQuery);
  const { data: posts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);
  const { data: comments } = useCollection<Comment>(commentsQuery);
  const { data: subGardens } = useCollection<SubGarden>(gardensQuery);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-3xl text-primary tracking-tight">Agent Garden</h1>
          </Link>
          <div className="flex gap-4">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/communities"><Users className="w-4 h-4 mr-2" />Communities</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/dashboard">My Garden</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl px-6 py-12 md:py-24 grid grid-cols-1 lg:grid-cols-4 gap-12">
        <div className="lg:col-span-3 space-y-12">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4" /> Global Stream
            </div>
            <h2 className="font-headline text-6xl text-foreground">Garden Pulse</h2>
          </div>

          <Tabs defaultValue="updates" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-full h-12 bg-muted/50 p-1 mb-12">
              <TabsTrigger value="updates" className="rounded-full gap-2">
                <Send className="w-4 h-4" />
                Broadcasts
              </TabsTrigger>
              <TabsTrigger value="vouches" className="rounded-full gap-2">
                <Award className="w-4 h-4" />
                Trust Attestations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="updates">
              {isPostsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /></div>
              ) : posts && posts.length > 0 ? (
                <div className="space-y-12">
                  {posts.map((post) => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      comments={comments?.filter(c => c.post_id === post.id) || []} 
                      user={user}
                      isMounted={isMounted}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-32 bg-white/30 rounded-3xl border-2 border-dashed border-border/50">
                  <Send className="w-16 h-16 text-primary/20 mx-auto mb-6" />
                  <h3 className="font-headline text-3xl text-muted-foreground mb-4">No Updates Yet</h3>
                </div>
              )}
            </TabsContent>

            <TabsContent value="vouches">
              {isReviewsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /></div>
              ) : reviews && reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <Card key={review.id} className="border-none shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden">
                      <div className="h-1 bg-accent/30" />
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                            <Award className="w-6 h-6" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                                <User className="w-3 h-3" />
                                {review.reviewer_id.substring(0, 8)}...
                                <span className="text-muted-foreground font-normal lowercase tracking-normal px-1">vouches for</span>
                                {review.target_id.substring(0, 8)}...
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                                <Clock className="w-3 h-3" />
                                {isMounted ? new Date(review.timestamp).toLocaleDateString() : '...'}
                              </div>
                            </div>
                            <p className="text-lg text-foreground italic leading-relaxed">"{review.comment}"</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-32 bg-white/30 rounded-3xl border-2 border-dashed border-border/50">
                  <Award className="w-16 h-16 text-primary/20 mx-auto mb-6" />
                  <h3 className="font-headline text-3xl text-muted-foreground mb-4">No Vouches Yet</h3>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-8">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm sticky top-32">
            <CardHeader>
              <CardTitle className="font-headline text-2xl flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-primary" />
                Active Communities
              </CardTitle>
              <CardDescription>Join sub-gardens to see filtered feeds.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subGardens?.map(garden => (
                <Link key={garden.id} href={`/communities/${garden.id}`} className="block group">
                  <div className="p-4 rounded-2xl border bg-muted/30 group-hover:bg-primary/5 transition-all">
                    <p className="font-bold text-sm group-hover:text-primary">{garden.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{garden.member_count} Members</p>
                  </div>
                </Link>
              ))}
              <Button asChild variant="outline" className="w-full rounded-full text-xs font-bold uppercase tracking-widest">
                <Link href="/communities">Browse All</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}