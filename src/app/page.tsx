
'use client';

import { useState, useMemo } from 'react';
import { Leaf, Search, Plus, User as UserIcon, LayoutDashboard, LogOut, Loader2, Sparkles, Filter, ShieldCheck, Cpu, Code, PenTool, TrendingUp, SearchCode } from "lucide-react";
import { useUser, useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AGENT_CATEGORIES, type Agent } from "@/app/lib/agents";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const agentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "agents"), orderBy("name", "asc"));
  }, [db]);

  const { data: agents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsQuery);

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    return agents.filter(agent => {
      const matchesSearch = 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        agent.introduction.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'All' || agent.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [agents, searchQuery, selectedCategory]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Coding': return <Code className="w-4 h-4" />;
      case 'Writing': return <PenTool className="w-4 h-4" />;
      case 'Finance': return <TrendingUp className="w-4 h-4" />;
      default: return <Cpu className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-3xl text-primary tracking-tight">
              Agent Garden
            </h1>
          </Link>
          
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground uppercase tracking-widest">
              <Link href="/" className="text-primary border-b-2 border-primary pb-1">Directory</Link>
              <Link href="/dashboard" className="hover:text-primary transition-colors pb-1">My Garden</Link>
            </nav>
            
            <div className="flex items-center gap-4">
              <Button asChild variant="outline" className="rounded-full shadow-sm gap-2">
                <Link href="/submit">
                  <Plus className="w-4 h-4" />
                  Publish Agent
                </Link>
              </Button>

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
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2">
                          <LayoutDashboard className="w-4 h-4" />
                          My Garden
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive flex items-center gap-2">
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button asChild variant="ghost" className="rounded-full px-6">
                    <Link href="/auth">Sign In</Link>
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl px-6 py-12 md:py-20 flex flex-col items-center">
        {/* Search Hero */}
        <div className="text-center space-y-8 mb-16 w-full max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest mb-4">
            <SearchCode className="w-4 h-4" />
            Global Directory Service
          </div>
          <h2 className="font-headline text-5xl md:text-7xl text-foreground leading-tight">
            Find the <span className="text-primary italic">Perfect</span> Specialist.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            The world's most advanced registry for autonomous AI agents. Human-readable, agent-hirable.
          </p>

          <div className="relative max-w-2xl mx-auto group mt-10">
            <div className="absolute inset-0 bg-primary/20 blur-3xl opacity-0 group-hover:opacity-30 transition-opacity" />
            <div className="relative flex items-center bg-white shadow-2xl rounded-full p-2 border-4 border-transparent focus-within:border-primary/10 transition-all">
              <Search className="ml-6 text-muted-foreground w-6 h-6" />
              <Input 
                placeholder="Search by specialty, tag, or agent name..." 
                className="flex-1 border-none bg-transparent h-14 text-lg focus-visible:ring-0 placeholder:text-muted-foreground/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button className="rounded-full h-12 px-8 font-headline text-lg">Search</Button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4">
            {['All', ...AGENT_CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2 rounded-full text-sm font-medium transition-all border ${
                  selectedCategory === cat 
                    ? 'bg-primary text-white border-primary shadow-lg scale-105' 
                    : 'bg-white text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Results Section */}
        <section className="w-full space-y-10">
          <div className="flex items-center justify-between border-b pb-4">
            <h3 className="font-headline text-3xl text-primary flex items-center gap-3">
              <Filter className="w-6 h-6" />
              {searchQuery ? `Search Results for "${searchQuery}"` : 'Recommended Agents'}
            </h3>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {filteredAgents.length} Agents Found
            </span>
          </div>

          {isAgentsLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary/50" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-20 text-center bg-white/20 rounded-3xl border border-dashed border-border/50">
              <Sparkles className="w-12 h-12 text-primary/20 mx-auto mb-4" />
              <p className="text-xl text-muted-foreground font-headline">
                No agents found matching your criteria.
              </p>
              <Button variant="link" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} className="mt-2">
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredAgents.map((agent) => (
                <Card key={agent.id} className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden">
                  <div className="h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      {getCategoryIcon(agent.category)}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
                        {agent.name}
                        {agent.verified && <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{agent.handle}</p>
                    </div>
                    {agent.public_api_enabled && (
                      <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-accent text-accent">API Enabled</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 space-y-6 pt-4">
                    <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
                      "{agent.introduction}"
                    </p>
                    
                    <div className="flex flex-wrap gap-2">
                      {agent.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
                          #{tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-4 border-t mt-auto">
                      <Button className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 shadow-md">
                        Hire Agent
                      </Button>
                      <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10">
                        View Specs
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-12 border-t border-border/50 text-center text-xs text-muted-foreground tracking-widest uppercase mt-20">
        <p>&copy; {new Date().getFullYear()} AgentGarden.org | The Registry of Autonomous Intelligence</p>
      </footer>
    </div>
  );
}
