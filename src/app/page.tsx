"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, Leaf, Loader2, Plus, LogOut, User as UserIcon } from "lucide-react";
import { semanticAgentSearch } from "@/ai/flows/semantic-agent-search";
import { MOCK_AGENTS, type Agent } from "@/app/lib/agents";
import { AgentCard } from "@/components/agent-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useUser, useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Agent[]>(MOCK_AGENTS);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.trim() === "") {
        setResults(MOCK_AGENTS);
        return;
      }

      setIsSearching(true);
      try {
        const matchingNames = await semanticAgentSearch({ query });
        if (matchingNames && matchingNames.length > 0) {
          const filtered = MOCK_AGENTS.filter((agent) =>
            matchingNames.includes(agent.name)
          );
          setResults(filtered);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Header */}
      <header className="w-full max-w-7xl px-6 py-8 flex items-center justify-between border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">
            Agent Garden
          </h1>
        </Link>
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex gap-8 text-sm font-medium text-muted-foreground uppercase tracking-widest">
            <Link href="/" className="hover:text-primary transition-colors">Directory</Link>
            <a href="#" className="hover:text-primary transition-colors">Verify</a>
            <a href="#" className="hover:text-primary transition-colors">About</a>
          </nav>
          
          <div className="flex items-center gap-4">
            <Button asChild className="rounded-full shadow-lg hover:shadow-xl transition-all gap-2 px-6">
              <Link href="/submit">
                <Plus className="w-4 h-4" />
                Submit Agent
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
                    <DropdownMenuLabel className="font-headline text-lg">My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-muted-foreground cursor-default">
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/submit" className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Plant New Agent
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
      </header>

      <main className="flex-1 w-full max-w-4xl px-6 py-12 md:py-24 flex flex-col items-center text-center">
        <div className="space-y-6 mb-16">
          <h2 className="font-headline text-5xl md:text-7xl text-foreground max-w-2xl mx-auto leading-tight">
            Discover the Seeds of <span className="text-primary italic">Intelligence</span>.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Search for specialized AI agents verified to handle complex tasks in your digital garden.
          </p>
        </div>

        {/* Search Experience */}
        <div className="w-full max-w-2xl relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {isSearching ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
            )}
          </div>
          <Input
            type="text"
            placeholder="Find an agent for security, woodworking, React..."
            className="w-full h-16 pl-12 pr-6 rounded-full border-2 border-border/50 bg-white shadow-xl text-lg font-medium transition-all focus-visible:ring-primary/20 focus-visible:border-primary group-hover:border-primary/30"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          <div className="mt-4 flex gap-4 justify-center text-xs text-muted-foreground">
            <span>Try searching:</span>
            <button onClick={() => setQuery("security")} className="underline hover:text-primary transition-colors">"security"</button>
            <button onClick={() => setQuery("building a table")} className="underline hover:text-primary transition-colors">"building a table"</button>
            <button onClick={() => setQuery("bug fix")} className="underline hover:text-primary transition-colors">"bug fix"</button>
          </div>
        </div>

        {/* Results Grid */}
        <section className="mt-20 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
          {results.length > 0 ? (
            results.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))
          ) : (
            <div className="col-span-full py-20 text-center">
              <p className="text-muted-foreground text-lg italic">
                No agents found for this search. Try planting a different seed.
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="w-full py-12 border-t border-border/50 text-center text-xs text-muted-foreground tracking-widest uppercase mt-20">
        <p>&copy; {new Date().getFullYear()} AgentGarden.org | Curating intelligence since 2025</p>
      </footer>
    </div>
  );
}
