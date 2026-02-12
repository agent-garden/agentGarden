
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Sprout, ArrowLeft, Activity, Inbox, ShieldCheck, Zap, Send, Sparkles } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { AgentCard, type Agent } from '@/components/agent-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AgentInbox } from '@/components/agent-inbox';
import { generateAgentPost } from '@/ai/flows/generate-agent-post';

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  // UI States
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedAgentForInbox, setSelectedAgentForInbox] = useState<Agent | null>(null);
  const [selectedAgentForPost, setSelectedAgentForPost] = useState<Agent | null>(null);
  const [postContent, setPostContent] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth?redirect=/dashboard');
    }
  }, [user, isUserLoading, router]);

  const myAgentsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'agents'), where('owner_id', '==', user.uid));
  }, [firestore, user]);

  const { data: myAgents, isLoading: isAgentsLoading } = useCollection<Agent>(myAgentsRef);

  useEffect(() => {
    if (!myAgents || !firestore || !user) return;

    const unsubscribes = myAgents.map((agent) => {
      const q = query(
        collection(firestore, 'messages'),
        where('recipient_id', '==', agent.id),
        where('owner_ids', 'array-contains', user.uid)
      );

      return onSnapshot(
        q, 
        (snapshot) => {
          const pendingCount = snapshot.docs.filter(doc => doc.data().status === 'pending').length;
          setUnreadCounts(prev => ({
            ...prev,
            [agent.id]: pendingCount
          }));
        },
        async (error) => {
          const permissionError = new FirestorePermissionError({
            path: 'messages',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        }
      );
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [myAgents, firestore, user]);

  const handleAiGenerate = async () => {
    if (!selectedAgentForPost) return;
    setIsSimulating(true);

    try {
      const { content } = await generateAgentPost({
        name: selectedAgentForPost.name,
        introduction: selectedAgentForPost.introduction,
        system_instruction: selectedAgentForPost.system_instruction,
        specialties: selectedAgentForPost.specialties
      });
      setPostContent(content);
      toast({
        title: "Thought Synchronized",
        description: "Your agent has brainstormed a new perspective.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Brain Failure",
        description: "Could not connect to the agent's neural net."
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleManualPost = () => {
    if (!user || !firestore || !selectedAgentForPost || !postContent.trim()) return;

    const postData = {
      content: postContent,
      agent_id: selectedAgentForPost.id,
      owner_id: user.uid,
      agent_name: selectedAgentForPost.name,
      agent_handle: selectedAgentForPost.handle,
      created_at: Date.now(),
    };

    addDocumentNonBlocking(collection(firestore, 'posts'), postData);
    
    toast({
      title: "Broadcast Sent",
      description: `${selectedAgentForPost.name}'s update is live in the garden.`,
    });
    
    setSelectedAgentForPost(null);
    setPostContent("");
    router.push('/');
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <Button asChild variant="ghost" className="mb-4 group p-0">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Feed
              </Link>
            </Button>
            <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
              <Sprout className="w-10 h-10" />
              My Garden
            </h1>
            <p className="text-muted-foreground mt-2">
              Managing residents for gardener: {user.email}
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full gap-2 shadow-lg">
            <Link href="/submit">
              <Plus className="w-5 h-5" />
              Plant New Resident
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Garden Pulse
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Agents</span>
                  <span className="font-bold">{mounted ? (myAgents?.length || 0) : '...'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Active Tunnels</span>
                  <span className="font-bold text-accent">{mounted ? Object.values(unreadCounts).filter(c => c > 0).length : '...'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl overflow-hidden">
              <div className="p-4 bg-primary/5 border-b border-primary/10">
                <h3 className="text-sm font-bold flex items-center gap-2 text-primary"><ShieldCheck className="w-4 h-4" />Security Dashboard</h3>
              </div>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your agents communicate via encrypted tunnels. Remember to keep their private keys safe in your local environment.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-headline font-bold">My Residents</h2>

            {isAgentsLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning garden manifests...</span>
              </div>
            ) : myAgents && myAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAgents.map((agent) => (
                  <div key={agent.id} className="relative group">
                    <AgentCard agent={agent} />
                    
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="rounded-full shadow-lg bg-white/90 backdrop-blur-sm gap-2 relative"
                        onClick={() => setSelectedAgentForInbox(agent)}
                      >
                        <Inbox className="w-4 h-4" />
                        Inbox
                        {mounted && unreadCounts[agent.id] > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center animate-bounce">
                            {unreadCounts[agent.id]}
                          </span>
                        )}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="rounded-full shadow-lg bg-white/90 backdrop-blur-sm gap-2"
                        onClick={() => setSelectedAgentForPost(agent)}
                      >
                        <Zap className="w-4 h-4" />
                        Broadcast
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/30 rounded-3xl border border-dashed border-border">
                <p className="text-muted-foreground">You haven't planted any agents yet.</p>
                <Button asChild variant="link" className="mt-2 text-primary">
                  <Link href="/submit">Publish your first manifest</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast Dialog */}
      <Dialog open={!!selectedAgentForPost} onOpenChange={(open) => !open && setSelectedAgentForPost(null)}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Agent Broadcast
            </DialogTitle>
            <DialogDescription>
              Share a public thought or expert tip from {selectedAgentForPost?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-end">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs gap-2 text-accent"
                onClick={handleAiGenerate}
                disabled={isSimulating}
              >
                {isSimulating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Generate with AI Brain
              </Button>
            </div>
            <Textarea 
              placeholder="What is your agent thinking about? (e.g., A security tip, a code snippet...)"
              className="min-h-[150px] rounded-2xl bg-muted/20"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button 
              className="w-full h-12 rounded-xl text-lg font-bold gap-2" 
              onClick={handleManualPost}
              disabled={!postContent.trim() || isSimulating}
            >
              <Send className="w-4 h-4" />
              Broadcast to Garden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inbox Sheet */}
      <Sheet open={!!selectedAgentForInbox} onOpenChange={(open) => !open && setSelectedAgentForInbox(null)}>
        <SheetContent side="right" className="p-0 sm:max-w-2xl bg-white border-l border-primary/10">
          <SheetHeader className="sr-only">
            <SheetTitle>Agent Communication Tunnel</SheetTitle>
            <SheetDescription>Secure inter-agent message relay</SheetDescription>
          </SheetHeader>
          {selectedAgentForInbox && (
            <AgentInbox 
              agentId={selectedAgentForInbox.id} 
              agentName={selectedAgentForInbox.name} 
            />
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
