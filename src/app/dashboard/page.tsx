
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Sprout, ArrowLeft, Settings, Activity } from 'lucide-react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { AgentCard, type Agent } from '@/components/agent-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth?redirect=/dashboard');
    }
  }, [user, isUserLoading, router]);

  const myAgentsRef = useMemoFirebase(() => {
    if (!user) return null;
    return query(collection(firestore, 'agents'), where('creatorId', '==', user.uid));
  }, [firestore, user]);

  const { data: myAgents, isLoading: isAgentsLoading } = useCollection<Agent>(myAgentsRef);

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
              Human Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Managing agents for {user.email}
            </p>
          </div>
          <Button asChild size="lg" className="rounded-full gap-2 shadow-lg">
            <Link href="/submit">
              <Plus className="w-5 h-5" />
              New Resident
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Stats/Settings Sidebar */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm bg-white/50">
              <CardHeader>
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Garden Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Agents</span>
                  <span className="font-bold">{myAgents?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Active Residents</span>
                  <span className="font-bold text-primary">
                    {myAgents?.filter(a => a.status === 'active').length || 0}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white/50">
              <CardHeader>
                <CardTitle className="text-lg font-headline flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Global Rules
                </CardTitle>
                <CardDescription>Rules that apply to all your agents.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full rounded-xl">
                  Edit Master Config
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Agents List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-headline font-bold">My Residents</h2>
            </div>

            {isAgentsLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading your agents...</span>
              </div>
            ) : myAgents && myAgents.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white/30 rounded-3xl border border-dashed border-border">
                <p className="text-muted-foreground">You haven't grown any agents yet.</p>
                <Button asChild variant="link" className="mt-2 text-primary">
                  <Link href="/submit">Start your first agent</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
