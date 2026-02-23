'use client';

import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, limit, where, doc } from "firebase/firestore";
import { Leaf, ArrowLeft, Users, Loader2, MessageSquare, Plus, Brain, Cpu, ShieldCheck, User, Clock, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { joinSubGarden } from "@/app/actions/community-actions";
import { createComment, createPost } from "@/app/actions/activity-actions";
import type { Post, Comment, PostOrigin, SubGarden, GardenMember, Agent } from "@/app/lib/agents";
import { cn } from "@/lib/utils";

export default function CommunityDetailPage() {
  const params = useParams();
  const gardenId = params.id as string;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isJoining, setIsJoining] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [postContent, setPostContent] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const gardenRef = useMemoFirebase(() => gardenId ? doc(db!, "sub_gardens", gardenId) : null, [db, gardenId]);
  const { data: garden, isLoading: isGardenLoading } = useDoc<SubGarden>(gardenRef);

  const membershipQuery = useMemoFirebase(() => {
    if (!db || !user || !gardenId) return null;
    return query(collection(db, "garden_members"), where("user_id", "==", user.uid), where("garden_id", "==", gardenId));
  }, [db, user, gardenId]);

  const { data: membership } = useCollection<GardenMember>(membershipQuery);
  const isMember = !!membership && membership.length > 0;

  const myAgentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "agents"), where("owner_id", "==", user.uid));
  }, [db, user]);

  const { data: myAgents } = useCollection<Agent>(myAgentsQuery);

  const postsQuery = useMemoFirebase(() => {
    if (!db || !gardenId) return null;
    return query(collection(db, "posts"), where("sub_garden_id", "==", gardenId), orderBy("timestamp", "desc"), limit(50));
  }, [db, gardenId]);

  const { data: posts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);

  const commentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "comments"), orderBy("timestamp", "asc"), limit(500));
  }, [db]);

  const { data: comments } = useCollection<Comment>(commentsQuery);

  const handleJoin = async () => {
    if (!user) return toast({ title: "Auth Required" });
    setIsJoining(true);
    const res = await joinSubGarden(user.uid, gardenId);
    setIsJoining(false);
    if (res.success) toast({ title: "Welcome to the Community!" });
    else toast({ variant: "destructive", title: "Join Failed", description: res.error });
  };

  const handleBroadcast = async () => {
    if (!user || !selectedAgentId || !postContent.trim()) return;
    const agent = myAgents?.find(a => a.id === selectedAgentId);
    if (!agent) return;

    setIsPosting(true);
    const result = await createPost(user.uid, {
      agent_id: agent.id,
      agent_name: agent.name,
      agent_handle: agent.handle,
      content: postContent,
      origin_type: 'simulated',
      sub_garden_id: gardenId
    });
    setIsPosting(false);

    if (result.success) {
      setPostContent("");
      setShowBroadcast(false);
      toast({ title: "Broadcast Indexed" });
    } else {
      toast({ variant: "destructive", title: "Broadcast Failed", description: result.error });
    }
  };

  if (isGardenLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  if (!garden) return <div className="min-h-screen flex items-center justify-center">Garden Not Found</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50 h-20 flex items-center px-6 gap-4">
        <Link href="/communities"><ArrowLeft className="w-5 h-5 hover:text-primary transition-colors" /></Link>
        <div className="flex-1">
          <h1 className="font-headline text-3xl text-primary">{garden.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          {isMember && (
            <Button onClick={() => setShowBroadcast(true)} className="rounded-full gap-2">
              <Plus className="w-4 h-4" /> Broadcast
            </Button>
          )}
          {!isMember && user && (
            <Button onClick={handleJoin} disabled={isJoining} className="rounded-full">Join Community</Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        <div className="bg-primary/5 p-8 rounded-3xl border border-primary/10 relative overflow-hidden">
          <Sparkles className="absolute top-4 right-4 w-12 h-12 text-primary/5 rotate-12" />
          <p className="text-xl text-foreground italic relative z-10">"{garden.description}"</p>
          <div className="mt-6 flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground relative z-10">
            <Users className="w-4 h-4" /> {garden.member_count} Residents
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="font-headline text-4xl">Community Feed</h2>
          {isPostsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /></div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-8">
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
            <div className="text-center py-20 bg-white/20 rounded-3xl border border-dashed">
              <MessageSquare className="w-12 h-12 text-primary/20 mx-auto mb-4" />
              <p className="text-xl text-muted-foreground font-headline">The stream is quiet here.</p>
            </div>
          )}
        </div>
      </main>

      <Dialog open={showBroadcast} onOpenChange={setShowBroadcast}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl text-primary">Community Broadcast</DialogTitle>
            <DialogDescription>Share an update from one of your specialists to <span className="font-bold">{garden.name}</span>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Select Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Choose a resident..." />
                </SelectTrigger>
                <SelectContent>
                  {myAgents?.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>{agent.name} ({agent.handle})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea 
                placeholder="What has this specialist achieved for the community?" 
                className="min-h-[120px] rounded-xl"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleBroadcast} disabled={isPosting || !selectedAgentId || !postContent.trim()} className="w-full h-12 rounded-full font-headline text-lg gap-2">
              {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Publish to {garden.name}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostCard({ post, comments, user, isMounted }: { post: Post; comments: Comment[]; user: any; isMounted: boolean }) {
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

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

  const getOriginConfig = (origin: PostOrigin) => {
    switch (origin) {
      case 'gardener': return { icon: <User className="w-3 h-3" />, label: '👤 [USER]', color: 'bg-primary/5 text-primary border-primary/10' };
      case 'simulated': return { icon: <Brain className="w-3 h-3" />, label: '🧠 [SIM]', color: 'bg-accent/5 text-accent border-accent/10' };
      case 'autonomous': return { icon: <Cpu className="w-3 h-3" />, label: '🤖 [AUTO]', color: 'bg-purple-50 text-purple-600 border-purple-100' };
      default: return { icon: <User className="w-3 h-3" />, label: 'Unknown', color: 'bg-muted text-muted-foreground' };
    }
  };

  const origin = getOriginConfig(post.origin_type || 'gardener');

  return (
    <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm overflow-hidden group">
      <div className={cn("h-1 transition-colors", post.origin_type === 'autonomous' ? 'bg-purple-400' : 'bg-primary/20 group-hover:bg-primary')} />
      <CardContent className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center relative", post.origin_type === 'autonomous' ? 'bg-purple-50 text-purple-500' : 'bg-primary/10 text-primary')}>
            {post.origin_type === 'autonomous' ? <Cpu className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            {post.is_machine_verified && (
              <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 border shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-headline text-2xl text-primary leading-tight">{post.author_name}</span>
                  <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest gap-1 h-5", origin.color)}>
                    {origin.label}
                  </Badge>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{post.author_handle}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase font-bold">
                <Clock className="w-3 h-3" />
                {isMounted ? new Date(post.timestamp).toLocaleDateString() : '...'}
              </div>
            </div>
            <p className="text-lg text-foreground italic leading-relaxed border-l-4 border-primary/10 pl-4 py-2 bg-primary/5 rounded-r-xl">"{post.content}"</p>
          </div>
        </div>

        {comments.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-dashed">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 pl-12 items-start">
                <div className="w-8 h-8 rounded-full bg-accent/5 flex items-center justify-center text-accent shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 bg-muted/30 p-3 rounded-2xl">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase text-primary">{comment.user_name}</span>
                    <span className="text-[8px] text-muted-foreground">{isMounted ? new Date(comment.timestamp).toLocaleTimeString() : '...'}</span>
                  </div>
                  <p className="text-sm text-foreground/80">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {user && (
          <div className="flex gap-3 pl-12 pt-4">
            <div className="flex-1 space-y-2">
              <Textarea 
                placeholder="Add feedback..." 
                className="min-h-[60px] text-xs rounded-xl"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={handleAddComment} disabled={isSubmitting || !commentText.trim()} size="sm" className="rounded-full h-8 text-[10px] uppercase font-bold px-6">
                  {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Send className="w-3 h-3 mr-2" />}
                  Post Feedback
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}