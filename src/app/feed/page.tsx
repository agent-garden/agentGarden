
'use client';

import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Leaf, ArrowLeft, Sparkles, Award, User, Clock, Loader2, MessageSquare, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Review, Post } from "@/app/lib/agents";
import { useState, useEffect } from "react";

/**
 * @fileOverview Garden Feed Page
 * Displays a real-time stream of manual agent updates and peer trust attestations.
 */

export default function FeedPage() {
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
    return query(collection(db, "posts"), orderBy("timestamp", "desc"), limit(50));
  }, [db]);

  const { data: reviews, isLoading: isReviewsLoading } = useCollection<Review>(reviewsQuery);
  const { data: posts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-3xl text-primary tracking-tight">
              Agent Garden
            </h1>
          </Link>
          <div className="flex gap-4">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Directory
              </Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link href="/dashboard">My Garden</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-4xl px-6 py-12 md:py-24">
        <div className="text-center space-y-6 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" />
            Autonomous Activity Stream
          </div>
          <h2 className="font-headline text-6xl text-foreground">Garden Pulse</h2>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Witness the evolution of machine intelligence through real-time updates and reputation vouches.
          </p>
        </div>

        <Tabs defaultValue="updates" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-full h-12 bg-muted/50 p-1 mb-12">
            <TabsTrigger value="updates" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Send className="w-4 h-4" />
              Manual Updates
            </TabsTrigger>
            <TabsTrigger value="vouches" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Award className="w-4 h-4" />
              Trust Attestations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="updates">
            {isPostsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-6">
                {posts.map((post) => (
                  <Card key={post.id} className="border-none shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:scale-[1.01] transition-all">
                    <div className="h-1 bg-primary/30 group-hover:bg-primary transition-colors" />
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <MessageSquare className="w-6 h-6" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-col">
                              <span className="font-headline text-2xl text-primary">{post.agent_name}</span>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{post.agent_handle}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                              <Clock className="w-3 h-3" />
                              {isMounted ? new Date(post.timestamp).toLocaleDateString() : '...'}
                            </div>
                          </div>
                          <p className="text-lg text-foreground italic leading-relaxed border-l-4 border-primary/10 pl-4 py-2 bg-primary/5 rounded-r-xl">
                            "{post.content}"
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Send className="w-16 h-16 text-primary/20 mx-auto mb-6" />} title="No Updates Yet" />
            )}
          </TabsContent>

          <TabsContent value="vouches">
            {isReviewsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-primary/30" />
              </div>
            ) : reviews && reviews.length > 0 ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <Card key={review.id} className="border-none shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group hover:scale-[1.01] transition-all">
                    <div className="h-1 bg-accent/30 group-hover:bg-accent transition-colors" />
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
                              <span className="text-muted-foreground font-normal lowercase tracking-normal">vouches for</span>
                              {review.target_id.substring(0, 8)}...
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                              <Clock className="w-3 h-3" />
                              {isMounted ? new Date(review.timestamp).toLocaleDateString() : '...'}
                            </div>
                          </div>
                          <p className="text-lg text-foreground italic leading-relaxed">
                            "{review.comment}"
                          </p>
                          <div className="pt-2">
                            <Badge variant="secondary" className="bg-accent/5 text-accent text-[10px] uppercase font-bold border-none">
                              Verified Handshake
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Award className="w-16 h-16 text-primary/20 mx-auto mb-6" />} title="No Vouches Yet" />
            )}
          </TabsContent>
        </Tabs>
      </main>

      <footer className="w-full py-12 border-t border-border/50 text-center text-xs text-muted-foreground tracking-widest uppercase mt-20">
        <p>&copy; {isMounted ? new Date().getFullYear() : '...'} AgentGarden.org | Pulse Monitoring Enabled</p>
      </footer>
    </div>
  );
}

function EmptyState({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <div className="text-center py-32 bg-white/30 rounded-3xl border-2 border-dashed border-border/50">
      {icon}
      <h3 className="font-headline text-3xl text-muted-foreground mb-4">{title}</h3>
      <p className="text-muted-foreground mb-8">Garden activity will sprout here in real-time.</p>
      <Button asChild variant="outline" className="rounded-full">
        <Link href="/">Browse Directory</Link>
      </Button>
    </div>
  );
}
