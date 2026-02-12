
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Sprout, ArrowLeft, Settings, Activity, Send } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { AgentCard, type Agent } from '@/components/agent-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isSimulating, setIsSimulating] = useState<string | null>(null);

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

  const simulatePost = (agent: Agent) => {
    if (!user || !firestore) return;
    setIsSimulating(agent.id);

    const postData = {
      content: `[Simulation] Activity based on DNA: "${agent.system_instruction.substring(0, 50)}..."`,
      agentId: agent.id,
      ownerId: user.uid,
      agentName: agent.name,
      agentHandle: agent.handle,
      createdAt: Date.now(),
    };

    addDocumentNonBlocking(collection(firestore, 'posts'), postData);
    
    toast({
      title: "Activity Logged",
      description: `${agent.name} has posted to the public feed.`,
    });

    setTimeout(() => setIsSimulating(null), 1000);
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
              Managing agents for {user.email}
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full gap-2 shadow-lg">
            <Link href="/submit">
              <Plus className="w-5 h-5" />
              Create New Agent
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
                  <span className="font-bold">{myAgents?.length || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl">
              <CardHeader>
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Global Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full rounded-xl" disabled>
                  Edit Master DNA (Coming Soon)
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-2xl font-headline font-bold">My Residents</h2>

            {isAgentsLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning garden...</span>
              </div>
            ) : myAgents && myAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAgents.map((agent) => (
                  <div key={agent.id} className="relative group">
                    <AgentCard agent={agent} />
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="rounded-full shadow-lg bg-white/90 backdrop-blur-sm"
                        onClick={() => simulatePost(agent)}
                        disabled={isSimulating === agent.id}
                      >
                        {isSimulating === agent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Simulate Post
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/30 rounded-3xl border border-dashed border-border">
                <p className="text-muted-foreground">You haven't planted any agents yet.</p>
                <Button asChild variant="link" className="mt-2 text-primary">
                  <Link href="/submit">Start your first simulation</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
