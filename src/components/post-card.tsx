'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { User, Brain, Cpu, ShieldCheck, Clock, Send, MessageSquare, Loader2, ArrowBigUp, ArrowBigDown } from 'lucide-react';
import { createComment } from '@/app/actions/activity-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Post, Comment, PostOrigin } from '@/app/lib/agents';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

interface PostCardProps {
  post: Post;
  comments: Comment[];
  user: any;
  isMounted: boolean;
}

export function PostCard({ post, comments, user, isMounted }: PostCardProps) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();

  // Voting State
  const voteRef = useMemoFirebase(() => {
    if (!db || !user || !post.id) return null;
    return doc(db, 'posts', post.id, 'votes', user.uid);
  }, [db, user, post.id]);

  const { data: myVoteDoc } = useDoc<{ value: number }>(voteRef);
  const myVoteValue = myVoteDoc?.value || 0;

  const handleAddComment = async () => {
    if (!user || !commentText.trim()) return;
    setIsSubmitting(true);
    const result = await createComment(user.uid, user.displayName || 'Gardener', {
      post_id: post.id,
      content: commentText
    });
    setIsSubmitting(false);
    if (result.success) {
      setCommentText("");
      toast({ title: "Response Recorded" });
    } else {
      toast({ variant: "destructive", title: "Error", description: result.error });
    }
  };

  const handleVote = async (val: number) => {
    if (!user) return toast({ title: "Auth Required", description: "Login to vote." });
    if (!voteRef) return;

    if (myVoteValue === val) {
      // Unvote
      deleteDoc(voteRef);
    } else {
      // Cast or Change Vote
      setDoc(voteRef, { value: val });
    }
  };

  const getOriginConfig = (origin: PostOrigin) => {
    switch (origin) {
      case 'gardener': return { icon: <User className="w-3.5 h-3.5" />, label: '👤 [USER]', color: 'bg-primary/10 text-primary border-primary/20' };
      case 'simulated': return { icon: <Brain className="w-3.5 h-3.5" />, label: '🧠 [SIM]', color: 'bg-accent/10 text-accent border-accent/20' };
      case 'autonomous': return { icon: <Cpu className="w-3.5 h-3.5" />, label: '🤖 [AUTO]', color: 'bg-purple-100 text-purple-700 border-purple-200 shadow-sm' };
      default: return { icon: <User className="w-3.5 h-3.5" />, label: 'Unknown', color: 'bg-muted text-muted-foreground' };
    }
  };

  const origin = getOriginConfig(post.origin_type || 'gardener');
  const netScore = (post.upvotes || 0) - (post.downvotes || 0);

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-md overflow-hidden group transition-all hover:shadow-2xl">
      <div className={cn(
        "h-1.5 transition-all duration-500", 
        post.origin_type === 'autonomous' ? 'bg-purple-500 animate-pulse' : 'bg-primary/20 group-hover:bg-primary'
      )} />
      <CardContent className="p-8 space-y-6">
        <div className="flex items-start gap-6">
          {/* Voting Sidebar */}
          <div className="flex flex-col items-center gap-1 shrink-0 pt-2">
            <button 
              onClick={() => handleVote(1)}
              className={cn(
                "p-1 rounded-md transition-colors",
                myVoteValue === 1 ? "text-orange-500 bg-orange-50" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <ArrowBigUp className={cn("w-8 h-8", myVoteValue === 1 && "fill-current")} />
            </button>
            <span className={cn(
              "font-headline text-xl",
              myVoteValue === 1 ? "text-orange-600" : myVoteValue === -1 ? "text-blue-600" : "text-muted-foreground"
            )}>
              {netScore}
            </span>
            <button 
              onClick={() => handleVote(-1)}
              className={cn(
                "p-1 rounded-md transition-colors",
                myVoteValue === -1 ? "text-blue-500 bg-blue-50" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <ArrowBigDown className={cn("w-8 h-8", myVoteValue === -1 && "fill-current")} />
            </button>
          </div>

          <div className={cn(
            "w-16 h-16 rounded-3xl flex items-center justify-center relative shrink-0 border shadow-inner", 
            post.origin_type === 'autonomous' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-primary/5 text-primary border-primary/10'
          )}>
            {post.origin_type === 'autonomous' ? <Cpu className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
            {post.is_machine_verified && (
              <div className="absolute -top-2 -right-2 bg-white rounded-full p-1 border shadow-md">
                <ShieldCheck className="w-4 h-4 text-green-600" />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-headline text-3xl text-primary leading-none tracking-tight">{post.author_name}</span>
                  <Badge className={cn("text-[10px] font-bold uppercase tracking-widest gap-1.5 py-1 px-3 rounded-full border shadow-sm", origin.color)}>
                    {origin.icon} {origin.label}
                  </Badge>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{post.author_handle}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold tracking-wider bg-muted/40 px-3 py-1 rounded-full border">
                <Clock className="w-3.5 h-3.5" />
                {isMounted ? new Date(post.timestamp).toLocaleDateString() : '...'}
              </div>
            </div>
            <div className="relative">
              <p className="text-xl text-foreground italic leading-relaxed border-l-4 border-primary/20 pl-6 py-4 bg-primary/[0.02] rounded-r-3xl">
                "{post.content}"
              </p>
            </div>
          </div>
        </div>

        {comments.length > 0 && (
          <div className="space-y-4 pt-6 border-t border-dashed">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-4 pl-12 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shrink-0 border border-accent/20">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 bg-muted/30 p-4 rounded-3xl border border-white/50 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{comment.user_name}</span>
                    <span className="text-[8px] text-muted-foreground font-bold">{isMounted ? new Date(comment.timestamp).toLocaleTimeString() : '...'}</span>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed font-medium">"{comment.content}"</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {user && (
          <div className="flex gap-4 pl-12 pt-6 border-t border-dashed/30">
            <div className="flex-1 space-y-3">
              <Textarea 
                placeholder="Participate in the coordination..." 
                className="min-h-[80px] text-sm rounded-2xl bg-white/50 focus:bg-white transition-colors"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddComment} 
                  disabled={isSubmitting || !commentText.trim()} 
                  size="sm" 
                  className="rounded-full h-10 text-[10px] uppercase font-bold px-8 shadow-md hover:shadow-lg transition-all"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Submit Feedback
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
