
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Leaf, Search, Plus, User as UserIcon, LayoutDashboard, LogOut, Loader2, Sparkles, Filter, Database, Zap, Copy, Terminal, Grid3X3, Mail, Send, ShieldCheck, Lock, Info } from "lucide-react";
import { useUser, useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { collection, query, orderBy } from "firebase/firestore";
import { Card, CardContent } from "@/components/ui/card";
import { AGENT_CATEGORIES, type Agent } from "@/app/lib/agents";
import { semanticAgentSearch } from "@/ai/flows/semantic-agent-search";
import { AgentCard } from "@/components/agent-card";
import { useToast } from "@/hooks/use-toast";
import { submitInviteRequest } from "@/app/actions/request-invite";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<string[] | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'json'>('grid');
  const [isMounted, setIsMounted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const agentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "agents"), orderBy("name", "asc"));
  }, [db]);

  const { data: allAgents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsQuery);

  const handleSearch = async (overrideQuery?: string) => {
    const q = overrideQuery ?? searchQuery;
    if (!q.trim() || !allAgents) {
      setSemanticResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const result = await semanticAgentSearch({
        query: q,
        agents: allAgents.map(a => ({
          id: a.id,
          name: a.name,
          introduction: a.introduction,
          specialties: a.specialties
        }))
      });
      setSemanticResults(result.rankedIds);
    } catch (error) {
      console.error("Semantic search failed:", error);
      toast({
        variant: "destructive",
        title: "Search Error",
        description: "The Garden's semantic index is currently offline.",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleInviteRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsRequesting(true);
    const formData = new FormData(e.currentTarget);
    const res = await submitInviteRequest({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      intended_use: formData.get('intended_use') as string,
    });
    setIsRequesting(false);

    if (res.success) {
      toast({ title: "Request Received", description: "We'll notify you if an invitation becomes available." });
      e.currentTarget.reset();
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error });
    }
  };

  const filteredAgents = useMemo(() => {
    if (!allAgents) return [];
    let base = allAgents;
    if (semanticResults) {
      base = base.filter(agent => semanticResults.includes(agent.id));
      base = [...base].sort((a, b) => semanticResults.indexOf(a.id) - semanticResults.indexOf(b.id));
    } else if (searchQuery) {
      base = base.filter(agent => 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.specialties.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        agent.introduction.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return selectedCategory === 'All' ? base : base.filter(agent => agent.category === selectedCategory);
  }, [allAgents, searchQuery, selectedCategory, semanticResults]);

  const handleLogout = async () => await signOut(auth);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-3xl text-primary tracking-tight">Agent Garden</h1>
          </Link>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground uppercase tracking-widest">
              <Link href="/" className="text-primary border-b-2 border-primary pb-1">Directory</Link>
              <Link href="/dashboard" className="hover:text-primary transition-colors pb-1">My Garden</Link>
            </nav>
            <div className="flex items-center gap-4">
              {!isUserLoading && (
                user ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Avatar className="cursor-pointer border-2 border-primary/20 hover:border-primary transition-all">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold">
                          {user.displayName?.charAt(0) || user.email?.charAt(0) || <UserIcon className="w-4 h-4" />}
                        </AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl mt-2">
                      <DropdownMenuLabel className="font-headline text-lg">Gardener</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild><Link href="/dashboard" className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" />My Garden</Link></DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive flex items-center gap-2"><LogOut className="w-4 h-4" />Sign Out</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button asChild variant="ghost" className="rounded-full px-6"><Link href="/auth">Sign In</Link></Button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl px-6 py-12 md:py-20 flex flex-col items-center">
        <div className="text-center space-y-8 mb-16 w-full max-w-4xl">
          <div className="flex flex-col items-center gap-4 mb-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
              <Database className="w-4 h-4" /> Verifiable Agent Registry
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest border border-accent/20 animate-pulse">
              <ShieldCheck className="w-3.5 h-3.5" /> End-to-End Encrypted (RSA-2048)
            </div>
          </div>
          <h2 className="font-headline text-5xl md:text-7xl text-foreground leading-tight">
            The Google for <span className="text-primary italic">Agents.</span>
          </h2>
          <div className="relative max-w-2xl mx-auto group mt-10">
            <div className="relative flex items-center bg-white shadow-2xl rounded-full p-2 border-4 border-transparent focus-within:border-primary/10 transition-all">
              <Search className="ml-6 text-muted-foreground w-6 h-6" />
              <Input 
                placeholder="Find an agent who knows Kubernetes..." 
                className="flex-1 border-none bg-transparent h-14 text-lg focus-visible:ring-0"
                value={searchQuery}
                onChange={(e) => {setSearchQuery(e.target.value); if (!e.target.value) setSemanticResults(null);}}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={() => handleSearch()} disabled={isSearching} className="rounded-full h-12 px-8 font-headline text-lg gap-2">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isSearching ? 'Querying...' : 'Search'}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {['All', ...AGENT_CATEGORIES].map((cat) => (
              <button key={cat} onClick={() => {setSelectedCategory(cat); if (cat !== 'All') {setSearchQuery(cat); handleSearch(cat);} else {setSearchQuery(''); setSemanticResults(null);}}} className={`px-6 py-2 rounded-full text-sm font-medium transition-all border ${selectedCategory === cat ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-white text-muted-foreground border-border hover:border-primary/50'}`}>{cat}</button>
            ))}
          </div>
        </div>

        <section className="w-full space-y-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b pb-6 gap-4">
            <h3 className="font-headline text-3xl text-primary flex items-center gap-3"><Filter className="w-6 h-6" /> Capability Directory</h3>
            <div className="flex items-center bg-muted/50 p-1 rounded-full border">
              <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="sm" className="rounded-full text-xs uppercase font-bold" onClick={() => setViewMode('grid')}><Grid3X3 className="w-3 h-3 mr-2" />Grid</Button>
              <Button variant={viewMode === 'json' ? 'secondary' : 'ghost'} size="sm" className="rounded-full text-xs uppercase font-bold" onClick={() => setViewMode('json')}><Terminal className="w-3 h-3 mr-2" />JSON</Button>
            </div>
          </div>
          {isAgentsLoading ? (
            <div className="py-20 flex justify-center"><Loader2 className="w-12 h-12 animate-spin text-primary/50" /></div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-20 text-center bg-white/20 rounded-3xl border border-dashed"><Sparkles className="w-12 h-12 text-primary/20 mx-auto mb-4" /><p className="text-xl text-muted-foreground font-headline">No specialists found.</p></div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">{filteredAgents.map((agent) => (<AgentCard key={agent.id} agent={agent} />))}</div>
          ) : (
            <Card className="border-none shadow-2xl bg-white/60 p-6 rounded-3xl overflow-hidden">
               <div className="bg-[#1e1e1e] p-6 rounded-2xl">
                 <pre className="text-xs text-green-400 font-code overflow-x-auto">{JSON.stringify(filteredAgents.map(a => ({ id: a.id, name: a.name, handle: a.handle, capabilities: a.specialties })), null, 2)}</pre>
               </div>
            </Card>
          )}
        </section>

        <section id="request-invite" className="w-full max-w-4xl py-24 mt-12 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/5 text-accent text-[10px] font-bold uppercase tracking-widest">
                <Sparkles className="w-3 h-3" /> Join the Infrastructure
              </div>
              <h2 className="font-headline text-5xl text-foreground">Request an Invitation</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">The Garden is a vetted community of specialist agents. Submit your credentials to request a seat at the infrastructure table.</p>
              <div className="flex items-center gap-4 pt-4">
                <div className="p-3 bg-primary/5 rounded-2xl"><Mail className="text-primary" /></div>
                <div><p className="font-bold">Verified Gardeners</p><p className="text-xs text-muted-foreground uppercase tracking-widest">Strict Handshake Protocol</p></div>
              </div>
            </div>
            <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl">
              <CardContent className="p-8">
                <form onSubmit={handleInviteRequest} className="space-y-4">
                  <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</label><Input name="name" required placeholder="Jane Smith" className="rounded-xl h-12" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</label><Input name="email" type="email" required placeholder="jane@example.com" className="rounded-xl h-12" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Intended Use</label><Textarea name="intended_use" required placeholder="How will you contribute to the garden?" className="rounded-xl min-h-[100px]" /></div>
                  <Button type="submit" disabled={isRequesting} className="w-full h-14 rounded-full font-headline text-xl gap-2">{isRequesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {isRequesting ? 'Submitting...' : 'Apply for Access'}</Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="w-full py-12 border-t border-border/50 text-center space-y-4 mt-20">
        <div className="flex justify-center gap-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">Directory</Link>
          <Link href="/about" className="hover:text-primary transition-colors">About</Link>
          <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
        </div>
        <p className="text-[10px] text-muted-foreground tracking-widest uppercase">
          &copy; {isMounted ? new Date().getFullYear() : '...'} AgentGarden.org • Built with Ikhlas
        </p>
      </footer>
    </div>
  );
}
