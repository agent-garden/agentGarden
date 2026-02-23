
'use client';

import { useState, useEffect } from 'react';
import { 
  Search as SearchIcon, 
  Loader2, 
  Sprout, 
  LayoutDashboard, 
  LogIn, 
  LogOut, 
  Plus, 
  Sparkles, 
  Filter, 
  Cpu, 
  Activity, 
  ArrowRight, 
  FileJson, 
  User,
  MapPin,
  Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser, useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { AgentCard, type Agent } from '@/components/agent-card';
import { cn } from '@/lib/utils';
import { performAgentVectorSearch } from '@/ai/flows/perform-agent-vector-search';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const categories = ["All", "Coding", "Writing", "Finance", "Research", "Creative", "Other"];
const locations = ["All", "San Francisco", "London", "Cloud", "Dubai", "Tokyo"];
const timezones = ["All", "UTC", "PST", "EST", "GMT", "GMT+4", "JST"];

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedTimezone, setSelectedTimezone] = useState('All');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Agent[] | null>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'human' | 'agent'>('human');
  
  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const agentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'agents'), where('status', '==', 'active'));
  }, [db]);

  const { data: allAgents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsQuery);

  const handleSemanticSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim() && selectedLocation === 'All' && selectedTimezone === 'All') {
      setSemanticResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = await performAgentVectorSearch({ 
        query: searchQuery || "Verified Residents",
        location: selectedLocation === 'All' ? undefined : selectedLocation,
        timezone: selectedTimezone === 'All' ? undefined : selectedTimezone
      });
      setSemanticResults(results as Agent[]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Search failed",
        description: "Could not perform semantic ranking at this time."
      });
    } finally {
      setIsSearching(false);
    }
  };

  const displayAgents = semanticResults || (allAgents?.filter(agent => {
    const matchesCategory = activeCategory === 'All' || agent.category === activeCategory;
    const matchesLocation = selectedLocation === 'All' || agent.location === selectedLocation;
    const matchesTimezone = selectedTimezone === 'All' || agent.timezone === selectedTimezone;
    
    if (searchQuery && !semanticResults) {
      const queryLower = searchQuery.toLowerCase();
      return matchesCategory && matchesLocation && matchesTimezone && (
        agent.name?.toLowerCase().includes(queryLower) ||
        agent.specialties?.some(tag => tag.toLowerCase().includes(queryLower))
      );
    }
    return matchesCategory && matchesLocation && matchesTimezone;
  }) || []);

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
                <Link href="/submit"><Plus className="w-4 h-4 mr-2" />Publish Agent</Link>
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
          The "Google" for AI Agents. Use natural language to find verified residents by intent and expertise.
        </p>

        <form onSubmit={handleSemanticSearch} className="relative max-w-2xl mx-auto group">
          <div className="relative flex items-center bg-white rounded-3xl shadow-2xl border border-primary/10 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
            <div className="pl-6 text-primary"><SearchIcon className="w-6 h-6" /></div>
            <Input
              type="text"
              placeholder="e.g. Find me a Kubernetes security expert..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 text-xl h-20 px-6 font-headline"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!e.target.value && selectedLocation === 'All' && selectedTimezone === 'All') setSemanticResults(null);
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
          
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-xl border border-primary/5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <Select value={selectedLocation} onValueChange={(v) => { setSelectedLocation(v); setSemanticResults(null); }}>
                <SelectTrigger className="border-0 bg-transparent h-auto p-0 focus:ring-0 text-xs font-bold text-primary">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(loc => <SelectItem key={loc} value={loc} className="text-xs">{loc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 bg-white/50 px-3 py-1.5 rounded-xl border border-primary/5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <Select value={selectedTimezone} onValueChange={(v) => { setSelectedTimezone(v); setSemanticResults(null); }}>
                <SelectTrigger className="border-0 bg-transparent h-auto p-0 focus:ring-0 text-xs font-bold text-primary">
                  <SelectValue placeholder="Timezone" />
                </SelectTrigger>
                <SelectContent>
                  {timezones.map(tz => <SelectItem key={tz} value={tz} className="text-xs">{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="absolute -bottom-10 left-0 right-0 flex justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> Expertise Graph Active</div>
            <div className="flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Karma-Weighted Discovery</div>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2 mt-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setSemanticResults(null);
              }}
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
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <Filter className="w-5 h-5 text-accent" />
              {!mounted ? 'Scanning Garden...' : (semanticResults ? 'Semantic Matches' : (activeCategory === 'All' ? 'Verified Directory' : `${activeCategory} Residents`))}
              {mounted && (
                <span className="text-muted-foreground text-sm font-normal ml-2 bg-primary/5 px-2 py-0.5 rounded-md">
                  ({displayAgents.length} results)
                </span>
              )}
            </h2>
          </div>
          
          <div className="flex bg-white/50 p-1 rounded-xl border border-primary/10">
            <Button 
              variant={viewMode === 'human' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-lg gap-2"
              onClick={() => setViewMode('human')}
            >
              <User className="w-4 h-4" />
              Human
            </Button>
            <Button 
              variant={viewMode === 'agent' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-lg gap-2"
              onClick={() => setViewMode('agent')}
            >
              <FileJson className="w-4 h-4" />
              Agent
            </Button>
          </div>
        </div>

        {(isAgentsLoading || isSearching) ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-muted-foreground font-headline">
              {isSearching ? 'Analyzing intents and re-ranking by authority...' : 'Indexing the Agent Internet...'}
            </p>
          </div>
        ) : displayAgents.length > 0 ? (
          viewMode === 'human' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <Card className="border-none shadow-xl bg-slate-900 rounded-3xl overflow-hidden">
              <ScrollArea className="h-[600px] w-full p-6">
                <pre className="text-green-400 font-mono text-xs leading-relaxed">
                  {JSON.stringify({ 
                    discovery_protocol: "garden-v1-expertise-manifest",
                    query_metadata: {
                      intent: searchQuery || "browse",
                      category: activeCategory,
                      filters: { location: selectedLocation, timezone: selectedTimezone },
                      timestamp: mounted ? Date.now() : 0
                    },
                    results: displayAgents.map(a => ({
                      id: a.id,
                      name: a.name,
                      handle: a.handle,
                      location: a.location,
                      timezone: a.timezone,
                      specialties: a.specialties,
                      reputation: a.reputation,
                      public_key: a.public_key,
                      manifest_dna: a.system_instruction.substring(0, 100) + "..."
                    })) 
                  }, null, 2)}
                </pre>
              </ScrollArea>
            </Card>
          )
        ) : (
          <div className="text-center py-32 bg-white/50 backdrop-blur-sm rounded-3xl border border-dashed border-primary/20">
            <Sparkles className="w-16 h-16 text-primary/20 mx-auto mb-4" />
            <h3 className="text-2xl font-headline text-primary/70">The Dark Forest is quiet</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              No agents matching those specific expertise or operational criteria were found. Try a broader semantic query.
            </p>
            {user && (
              <Button asChild className="mt-8 rounded-full h-12 px-8" variant="default">
                <Link href="/submit">Publish Agent</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
