'use client';

import { useState } from 'react';
import { Search, Loader2, Sparkles, Sprout, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AgentCard, type Agent } from '@/components/agent-card';
import { performAgentVectorSearch } from '@/ai/flows/perform-agent-vector-search';
import Link from 'next/link';

export default function Home() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Agent[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const searchResults = await performAgentVectorSearch({ query });
      setResults(searchResults || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center bg-background p-6 md:p-12">
      {/* Top Navigation */}
      <div className="w-full max-w-7xl flex justify-end mb-8">
        <Button asChild variant="outline" className="rounded-full gap-2 border-primary/20 hover:bg-primary/5">
          <Link href="/submit">
            <Plus className="w-4 h-4" />
            Submit Agent
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-4 mt-4 md:mt-12">
        <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-primary/10 text-primary mb-2">
          <Sprout className="w-10 h-10" />
        </div>
        <h1 className="text-5xl md:text-7xl font-headline text-primary font-bold tracking-tight">
          Agent Garden
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground font-body max-w-xl mx-auto">
          Discover specialized AI agents grown to solve your unique challenges.
        </p>
      </div>

      {/* Search Section */}
      <div className="w-full max-w-3xl mt-12 mb-16">
        <form onSubmit={handleSearch} className="relative group">
          <div className="relative flex items-center bg-white rounded-3xl shadow-lg border border-border group-focus-within:ring-4 group-focus-within:ring-primary/20 transition-all duration-300">
            <div className="pl-6 text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <Input
              type="text"
              placeholder="e.g. 'help me with wood' or 'k8s hardening'"
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-lg h-16 py-4 px-4"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="pr-2">
              <Button 
                type="submit" 
                size="lg"
                className="rounded-full px-8 h-12 bg-primary hover:bg-accent text-primary-foreground font-headline font-bold"
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>
          </div>
        </form>
        
        <div className="flex justify-center gap-4 mt-6 text-xs text-muted-foreground/60">
          <span>Vector Search powered by Vertex AI</span>
          <span>•</span>
          <span>Firestore Database</span>
        </div>
      </div>

      {/* Results Section */}
      <div className="w-full max-w-5xl">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground animate-pulse font-headline">Tending to the garden...</p>
          </div>
        )}

        {!loading && hasSearched && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {results.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && (
          <div className="text-center py-20 bg-white/30 backdrop-blur-sm rounded-3xl border border-dashed border-border/60">
            <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-headline text-foreground/70">No agents found yet</h3>
            <p className="text-muted-foreground mt-2 font-body">Try a different query or submit a new agent.</p>
          </div>
        )}

        {!hasSearched && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
            {['Expert carpentry', 'Security audit', 'Performance tuning'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => {
                  setQuery(suggestion);
                  setTimeout(() => handleSearch(), 100);
                }}
                className="p-4 bg-white/40 hover:bg-white border border-border/50 rounded-2xl text-sm font-medium text-primary text-center transition-all hover:shadow-sm"
              >
                Try "{suggestion}"
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="mt-auto pt-20 pb-10 text-center">
        <p className="text-sm text-muted-foreground">
          Welcome to the Garden of AI possibilities.
        </p>
      </footer>
    </main>
  );
}
