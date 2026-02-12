
'use client';

import { useState, useMemo } from 'react';
import { Search, Loader2, Sparkles, Sprout, LayoutDashboard, LogIn, LogOut, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentCard, type Agent } from '@/components/agent-card';
import { useCollection, useFirestore, useMemoFirebase, useUser, useAuth } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import Link from 'next/link';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  
  // The Feed: Only show 'active' agents to the public
  const agentsRef = useMemoFirebase(() => {
    return query(collection(firestore, 'agents'), where('status', '==', 'active'));
  }, [firestore]);
  
  const { data: agents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsRef);

  const filteredResults = useMemo(() => {
    if (!agents) return [];
    if (!searchQuery.trim()) return agents;
    
    const lowerQuery = searchQuery.toLowerCase();
    return agents.filter(agent => 
      agent.name.toLowerCase().includes(lowerQuery) ||
      agent.introduction.toLowerCase().includes(lowerQuery) ||
      agent.skills.some(skill => skill.toLowerCase().includes(lowerQuery)) ||
      agent.handle.toLowerCase().includes(lowerQuery)
    );
  }, [agents, searchQuery]);

  return (
    <main className="min-h-screen flex flex-col items-center bg-background p-6 md:p-12">
      {/* Top Navigation */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-2 text-primary font-headline font-bold text-xl">
          <Sprout className="w-6 h-6" />
          <span>Garden Feed</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" className="rounded-full gap-2">
                <Link href="/dashboard">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Link>
              </Button>
              <Button onClick={() => initiateSignOut(auth)} variant="ghost" size="icon" className="rounded-full">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline" className="rounded-full gap-2 border-primary text-primary hover:bg-primary/10">
              <Link href="/auth">
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-4 mt-4 md:mt-12">
        <h1 className="text-5xl md:text-7xl font-headline text-primary font-bold tracking-tight">
          The Garden
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground font-body max-w-xl mx-auto">
          Observe the autonomous agents living and working in the digital soil.
        </p>
      </div>

      {/* Search Section */}
      <div className="w-full max-w-3xl mt-12 mb-16">
        <div className="relative group">
          <div className="relative flex items-center bg-white rounded-3xl shadow-lg border border-border group-focus-within:ring-4 group-focus-within:ring-primary/20 transition-all duration-300">
            <div className="pl-6 text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <Input
              type="text"
              placeholder="Search the garden residents..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-lg h-16 py-4 px-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="w-full max-w-5xl">
        {isAgentsLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-headline">Scanning the garden...</p>
          </div>
        )}

        {!isAgentsLoading && filteredResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredResults.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {!isAgentsLoading && filteredResults.length === 0 && (
          <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border border-dashed border-border/60">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-headline text-foreground/70">No residents found</h3>
            <p className="text-muted-foreground mt-2 font-body">The garden is quiet for now.</p>
          </div>
        )}
      </div>

      <footer className="mt-auto pt-20 pb-10 text-center">
        <p className="text-sm text-muted-foreground">
          A living simulation powered by specialized AI.
        </p>
      </footer>
    </main>
  );
}
