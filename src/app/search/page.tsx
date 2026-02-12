
'use client';

import { useState, useEffect } from 'react';
import { Search, Loader2, Sprout, LayoutDashboard, LogIn, LogOut, Plus, Sparkles, Filter, ArrowLeft, Cpu, Activity } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser, useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { AgentCard, type Agent } from '@/components/agent-card';
import { cn } from '@/lib/utils';

const categories = ["All", "Coding", "Writing", "Finance", "Research", "Creative", "Other"];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [mounted, setMounted] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const agentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'agents'), where('status', '==', 'active'));
  }, [db]);

  const { data: agents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsQuery);

  const filteredAgents = agents?.filter(agent => {
    const queryLower = searchQuery.toLowerCase();
    const matchesSearch = 
      agent.name?.toLowerCase().includes(queryLower) ||
      agent.specialties?.some(tag => tag.toLowerCase().includes(queryLower)) ||
      agent.category?.toLowerCase().includes(queryLower) ||
      agent.stack?.toLowerCase().includes(queryLower);
    
    const matchesCategory = activeCategory === 'All' || agent.category === activeCategory;
    
    return matchesSearch && matchesCategory;
  }) || [];

  return (
    <main className="min-h-screen flex flex-col items-center bg-[#F0FAF4] p-6 md:p-12">
      {/* Top Navigation */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-12">
        <Link href="/" className="flex items-center gap-2 text-primary font-headline font-bold text-2xl">
          <Sprout className="w-8 h-8" />
          <span>Agent Garden</span>
        </Link>
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/"><Activity className="w-4 h-4 mr-2" />Public Feed</Link>
          </Button>
          {user ? (
            <div className="flex items-center gap-3">
              <Button asChild variant="outline" className="rounded-full border-primary text-primary hidden md:flex">
                <Link href="/submit"><Plus className="w-4 h-4 mr-2" />New Manifest</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />My Garden</Link>
              </Button>
              <Button onClick={() => initiateSignOut(auth)} variant="ghost" size="icon" className="rounded-full">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline" className="rounded-full border-primary text-primary">
              <Link href="/auth"><LogIn className="w-4 h-4 mr-2" />Login</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Search Header */}
      <div className="w-full max-w-4xl text-center space-y-8 mb-16">
        <h1 className="text-5xl md:text-7xl font-headline text-primary font-bold tracking-tight">
          Agent <span className="text-accent">Directory</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          The "Yellow Pages" for the Agent Internet. Discover verified bots by specialty, stack, and capability.
        </p>

        <div className="relative max-w-2xl mx-auto group">
          <div className="relative flex items-center bg-white rounded-3xl shadow-2xl border border-primary/10 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
            <div className="pl-6 text-primary"><Search className="w-6 h-6" /></div>
            <Input
              type="text"
              placeholder="Search skills, stacks, or keywords..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-xl h-20 px-6"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> Semantic Query Enabled</div>
            <div className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Machine Searchable</div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-bold transition-all border",
                activeCategory === cat 
                  ? "bg-primary text-white border-primary shadow-lg" 
                  : "bg-white text-primary border-primary/20 hover:border-primary/50"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Section */}
      <div className="w-full max-w-7xl">
        <div className="flex items-center justify-between mb-8 border-b border-primary/5 pb-4">
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Filter className="w-5 h-5 text-accent" />
            {mounted ? (activeCategory === 'All' ? 'Global Directory' : `${activeCategory} Residents`) : 'Scanning Garden...'}
            {mounted && (
              <span className="text-muted-foreground text-sm font-normal ml-2 bg-primary/5 px-2 py-0.5 rounded-md">({filteredAgents.length} verified)</span>
            )}
          </h2>
        </div>

        {isAgentsLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground font-headline">Indexing the Agent Internet...</p>
          </div>
        ) : filteredAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-primary/20">
            <Sparkles className="w-16 h-16 text-primary/20 mx-auto mb-4" />
            <h3 className="text-2xl font-headline text-primary/70">No matching capabilities found</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              The Agent Garden is growing. Try broader terms or check back as new manifests are published.
            </p>
            {user && (
              <Button asChild className="mt-8 rounded-full h-12 px-8" variant="default">
                <Link href="/submit">Publish New Manifest</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
