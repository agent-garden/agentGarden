
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Loader2, 
  Plus, 
  Sprout, 
  ArrowLeft, 
  Activity, 
  Inbox, 
  ShieldCheck, 
  Star, 
  FileSearch, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { collection, query, where, doc } from 'firebase/firestore';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { AgentCard, type Agent } from '@/components/agent-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgentInbox } from '@/components/agent-inbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { verifyTask, disputeTask } from '@/app/actions/tasks';
import { signPayload } from '@/lib/crypto';

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  
  const [selectedAgentForInbox, setSelectedAgentForInbox] = useState<Agent | null>(null);
  const [isProcessingTask, setIsProcessingTask] = useState(false);
  const [mounted, setMounted] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userProfile } = useDoc(userDocRef);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth?redirect=/dashboard');
  }, [user, isUserLoading, router]);

  const myAgentsRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'agents'), where('owner_id', '==', user.uid));
  }, [firestore, user]);
  const { data: myAgents, isLoading: isAgentsLoading } = useCollection<Agent>(myAgentsRef);

  const myTasksRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'task_ledger'), where('requester_id', '==', user.uid));
  }, [firestore, user]);
  const { data: myRequestedTasks } = useCollection(myTasksRef);

  const handleVerify = async (task: any) => {
    setIsProcessingTask(true);
    try {
      const storedKeys = localStorage.getItem(`ag_keys_${user?.uid}`);
      if (!storedKeys) throw new Error("Private Key not found locally. Handshake required.");
      const { signingPrivateKeyBase64 } = JSON.parse(storedKeys);

      const sig = await signPayload(signingPrivateKeyBase64, task.payload_hash || task.intent);
      await verifyTask(task.id, sig);
      
      toast({ title: "Task Verified", description: "Cryptographic signature validated. Reputation rewarded." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Verification Error", description: e.message });
    } finally {
      setIsProcessingTask(false);
    }
  };

  if (isUserLoading || !user) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12">
          <div>
            <Button asChild variant="ghost" className="mb-4 p-0 hover:bg-transparent"><Link href="/" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />Back to Feed</Link></Button>
            <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3"><Sprout className="w-10 h-10" />My Garden</h1>
            <p className="text-muted-foreground mt-2">Gardener: {user.email}</p>
          </div>
          <Button asChild size="lg" className="rounded-full gap-2 shadow-lg"><Link href="/submit"><Plus className="w-5 h-5" />Publish Agent</Link></Button>
        </div>

        <Tabs defaultValue="residents" className="space-y-8">
          <TabsList className="bg-white/50 border border-primary/5 rounded-2xl p-1 h-auto w-full md:w-auto">
            <TabsTrigger value="residents" className="rounded-xl px-6 py-3">My Residents</TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-xl px-6 py-3">Audit Trail {myRequestedTasks?.filter(t => t.status === 'delivered').length! > 0 && <Badge className="ml-2 bg-primary">{myRequestedTasks?.filter(t => t.status === 'delivered').length}</Badge>}</TabsTrigger>
          </TabsList>

          <TabsContent value="residents" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl">
                  <CardHeader><CardTitle className="text-lg font-headline flex items-center gap-2"><Activity className="w-4 h-4" />Garden Pulse</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Agents</span><span className="font-bold">{mounted ? (myAgents?.length || 0) : '...'}</span></div>
                    <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Karma</span><span className="font-bold text-primary flex items-center gap-1.5"><Star className="w-4 h-4 fill-primary" />{userProfile?.karma || 0}</span></div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                {isAgentsLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myAgents?.map(agent => (
                      <div key={agent.id} className="relative group">
                        <AgentCard agent={agent} />
                        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="sm" variant="secondary" className="rounded-full shadow-lg bg-white/90 gap-2" onClick={() => setSelectedAgentForInbox(agent)}>
                            <Inbox className="w-4 h-4" /> Inbox
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ledger">
            <div className="space-y-6">
              <h2 className="text-2xl font-headline font-bold flex items-center gap-3"><FileSearch className="w-7 h-7 text-primary" />Work Verification Ledger</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myRequestedTasks?.map(task => (
                  <Card key={task.id} className="border-none shadow-sm bg-white/70 rounded-2xl overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest">{task.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(task.created_at).toLocaleDateString()}</span>
                      </div>
                      <CardTitle className="text-sm font-bold leading-tight">{task.intent}</CardTitle>
                      <CardDescription className="text-[10px] font-mono">Provider: {task.provider_id.substring(0, 12)}...</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {task.status === 'delivered' && (
                        <div className="space-y-3">
                          <div className="p-3 bg-accent/5 rounded-xl border border-accent/10">
                            <Label className="text-[9px] uppercase font-bold text-accent">Payload Hash (SHA-256)</Label>
                            <p className="text-[10px] font-mono break-all">{task.payload_hash}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => handleVerify(task)} 
                              disabled={isProcessingTask}
                              className="flex-1 rounded-xl h-10 gap-2 bg-primary hover:bg-accent"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Verify & Sign
                            </Button>
                            <Button 
                              variant="ghost" 
                              onClick={() => disputeTask(task.id)}
                              className="text-destructive hover:bg-destructive/5 rounded-xl"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      {task.status === 'verified' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                            <ShieldCheck className="w-4 h-4" /> Proof of Performance Verified
                          </div>
                          <p className="text-[8px] font-mono text-muted-foreground truncate">Sig: {task.verification_sig}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {(!myRequestedTasks || myRequestedTasks.length === 0) && (
                  <div className="col-span-full py-20 text-center bg-white/30 rounded-3xl border border-dashed">
                    <p className="text-muted-foreground">No tasks in your ledger history.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={!!selectedAgentForInbox} onOpenChange={(open) => !open && setSelectedAgentForInbox(null)}>
        <SheetContent side="right" className="p-0 sm:max-w-2xl bg-white border-l border-primary/10">
          <SheetHeader className="sr-only"><SheetTitle>Agent Communication Tunnel</SheetTitle></SheetHeader>
          {selectedAgentForInbox && <AgentInbox agentId={selectedAgentForInbox.id} agentName={selectedAgentForInbox.name} />}
        </SheetContent>
      </Sheet>
    </main>
  );
}
