
'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ShieldCheck, Loader2, ArrowLeft, Users, Settings, Database, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { collection, query, limit } from 'firebase/firestore';
import type { Agent } from '@/app/lib/agents';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const router = useRouter();
  const db = useFirestore();

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      
      try {
        // Force refresh the token to get the latest claims
        const idTokenResult = await user.getIdTokenResult(true);
        setIsAdmin(!!idTokenResult.claims.admin);
      } catch (error) {
        console.error("Error checking admin claims:", error);
        setIsAdmin(false);
      }
    }

    if (!isUserLoading) {
      if (!user) {
        router.push('/auth?redirect=/admin');
      } else {
        checkAdmin();
      }
    }
  }, [user, isUserLoading, router]);

  const allAgentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "agents"), limit(100));
  }, [db]);

  const { data: agents, isLoading: isAgentsLoading } = useCollection<Agent>(allAgentsQuery);

  if (isUserLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-24 h-24 bg-destructive/10 rounded-full flex items-center justify-center text-destructive">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h1 className="font-headline text-5xl text-foreground">Restricted Access</h1>
        <p className="text-muted-foreground text-xl max-w-md">
          This garden's inner sanctum is reserved for Master Gardeners only.
        </p>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-headline text-3xl text-primary flex items-center gap-2">
              <ShieldCheck className="w-8 h-8" />
              Master Gardener Console
            </h1>
          </div>
          <Button variant="outline" className="rounded-full" asChild>
            <Link href="/">Public View</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Agents</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-headline text-primary">{agents?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Specialists across all residents</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Registry Health</CardTitle>
              <Activity className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-headline text-accent">Optimal</div>
              <p className="text-xs text-muted-foreground mt-1">Latency: 42ms • Integrity: 100%</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Storage</CardTitle>
              <Database className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-headline text-foreground">Firestore</div>
              <p className="text-xs text-muted-foreground mt-1">Multi-regional deployment</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <h2 className="font-headline text-3xl">Global Specialist Manifest</h2>
          
          <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Agent Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Handle</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Owner UID</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isAgentsLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </td>
                  </tr>
                ) : agents && agents.length > 0 ? (
                  agents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 font-medium text-primary">{agent.name}</td>
                      <td className="px-6 py-4 font-code text-sm text-muted-foreground">{agent.handle}</td>
                      <td className="px-6 py-4 font-code text-xs text-muted-foreground">{agent.owner_id.substring(0, 12)}...</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          agent.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {agent.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Button variant="ghost" size="sm" className="rounded-full text-xs">Manage</Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                      No agents found in the global registry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
