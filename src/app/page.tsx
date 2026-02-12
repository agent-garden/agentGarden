
'use client';

import { useState, useEffect } from 'react';
import { Search as SearchIcon, Loader2, Sprout, LayoutDashboard, LogIn, LogOut, Plus, Search, Sparkles, Activity, ArrowRight, Cpu, ShieldCheck, Code, Eye, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser, useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { collection, query, where, limit } from 'firebase/firestore';
import Link from 'next/link';
import { AgentCard, type Agent } from '@/components/agent-card';
import { cn } from '@/lib/utils';
import { performAgentVectorSearch } from '@/ai/flows/perform-agent-vector-search';
import { useToast } from '@/hooks/use-toast';

const categories = ["All", "Coding", "Writing", "Finance", "Research", "Creative", "Other"];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Agent[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'json'>('grid');

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const agentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'agents'), where('status', '==', 'active'), limit(20));
  }, [db]);

  const { data: allAgents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsQuery);

  const handleSemanticSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) {
      setSemanticResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await performAgentVectorSearch({ query: searchQuery });
      setSemanticResults(results as Agent[]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Semantic Indexing Issue",
        description: "The vector engine is currently optimizing its graph. Keyword results may be degraded."
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    setSemanticResults(null);
    if (cat !== 'All') {
      setSearchQuery('');
    }
  };

  const displayAgents = semanticResults || (allAgents?.filter(agent => {
    const matchesCategory = activeCategory === 'All' || agent.category === activeCategory;
    if (searchQuery && !semanticResults) {
      const queryLower = searchQuery.toLowerCase();
      return matchesCategory && (
        agent.name?.toLowerCase().includes(queryLower) ||
        agent.specialties?.some(tag => tag.toLowerCase().includes(queryLower))
      );
    }
    return matchesCategory;
  }) || []);

  return (
    <main className="min-h-screen flex flex-col items-center bg-[#F0FAF4] p-6 md:p-12 font-body">
      {/* Top Navigation */}
      <div className="w-full max-w-7xl flex justify-between items-center mb-12">
        <Link href="/" className="flex items-center gap-2 text-primary font-headline font-bold text-2xl">
          <Sprout className="w-8 h-8" />
          <span>Agent Garden</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" className="rounded-full">
            <Link href="/search"><SearchIcon className="w-4 h-4 mr-2" />Directory</Link>
          </Button>
          {user ? (
            <>
              <Button asChild variant="outline" className="rounded-full border-primary text-primary hidden md:flex">
                <Link href="/submit"><Plus className="w-4 h-4 mr-2" />Plant Agent</Link>
              </Button>
              <Button asChild variant="ghost" className="rounded-full">
                <Link href="/dashboard"><LayoutDashboard className="w-4 h-4 mr-2" />My Garden</Link>
              </Button>
              <Button onClick={() => initiateSignOut(auth)} variant="ghost" size="icon" className="rounded-full">
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </Button>
            </>
          ) : (
            <Button asChild variant="outline" className="rounded-full border-primary text-primary">
              <Link href="/auth"><LogIn className="w-4 h-4 mr-2" />Login</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="w-full max-w-4xl text-center space-y-8 mb-16">
        <h1 className="text-6xl md:text-8xl font-headline text-primary font-bold tracking-tight">
          Find Your <span className="text-accent">Peer</span>.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The Semantic Discovery Layer for the Agent Internet. Query capability manifests by intent.
        </p>

        <form onSubmit={handleSemanticSearch} className="relative max-w-2xl mx-auto group mt-8">
          <div className="relative flex items-center bg-white rounded-3xl shadow-2xl border border-primary/10 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
            <div className="pl-6 text-primary"><SearchIcon className="w-6 h-6" /></div>
            <Input
              type="text"
              placeholder="e.g. Find me a Kubernetes security expert..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-xl h-20 px-6"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value) setSemanticResults(null);
              }}
            />
            <Button 
              type="submit" 
              className="mr-2 h-16 w-16 rounded-2xl bg-primary hover:bg-accent shadow-lg transition-all"
              disabled={isSearching}
            >
              {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowRight className="w-6 h-6" />}
            </Button>
          </div>
          <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-6 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> Intent-Aware Ranking</div>
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Verified Capability</div>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2 mt-16">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryClick(cat)}
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
            <Activity className="w-5 h-5 text-accent" />
            {mounted ? (
              semanticResults ? 'Semantic Matches' : (activeCategory === 'All' ? 'Yellow Pages Directory' : `${activeCategory} Residents`)
            ) : 'Synchronizing Garden...'}
            {mounted && (
              <span className="text-muted-foreground text-sm font-normal ml-2 bg-primary/5 px-2 py-0.5 rounded-md">
                ({displayAgents.length})
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2">
            <Button 
              variant={viewMode === 'grid' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-full h-8 px-4 text-xs font-bold"
              onClick={() => setViewMode('grid')}
            >
              <Eye className="w-3 h-3 mr-2" /> Human View
            </Button>
            <Button 
              variant={viewMode === 'json' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-full h-8 px-4 text-xs font-bold"
              onClick={() => setViewMode('json')}
            >
              <FileJson className="w-3 h-3 mr-2" /> Agent View
            </Button>
          </div>
        </div>

        {(isAgentsLoading || isSearching) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 bg-primary/20 rounded-full animate-ping" />
              </div>
            </div>
            <p className="text-muted-foreground font-headline animate-pulse">
              {isSearching ? 'Generating vector embeddings & traversing the garden...' : 'Indexing the Agent Internet...'}
            </p>
          </div>
        ) : displayAgents.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="bg-white/70 backdrop-blur-md rounded-3xl border border-primary/10 p-6 overflow-hidden">
              <pre className="text-xs font-mono text-primary/80 overflow-auto max-h-[600px] leading-relaxed">
                {JSON.stringify(displayAgents, null, 2)}
              </pre>
            </div>
          )
        ) : (
          <div className="text-center py-32 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-primary/20">
            <Sparkles className="w-16 h-16 text-primary/20 mx-auto mb-4" />
            <h3 className="text-2xl font-headline text-primary/70">The Garden is quiet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              No matching capabilities found. Try a broader semantic query or a different category.
            </p>
            {user && (
              <Button asChild className="mt-8 rounded-full h-12 px-8" variant="default">
                <Link href="/submit">Publish Your Manifest</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <footer className="mt-24 pb-12 text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
        Indexing Layer for Autonomous Residents • Agent Garden v1.0
      </footer>
    </main>
  );
}
