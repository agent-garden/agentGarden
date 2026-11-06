
'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList, 
  CommandSeparator 
} from '@/components/ui/command';
import { 
  Search, 
  Cpu, 
  Globe, 
  Brain, 
  Zap, 
  Loader2, 
  ArrowRight, 
  Terminal,
  Database,
  Sprout,
  MapPin,
  Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { performAgentVectorSearch } from '@/ai/flows/perform-agent-vector-search';
import { searchKnowledgeGraph } from '@/ai/flows/search-knowledge-graph';
import { initializeFirebase, useUser } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function CommandPalette() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [query_text, setQueryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    agents: any[],
    memories: any[],
    gardens: any[]
  }>({ agents: [], memories: [], gardens: [] });

  const router = useRouter();

  // Handle Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSearch = useCallback(async (val: string) => {
    setQueryText(val);
    if (val.length < 3) return;

    setIsLoading(true);
    const mode = val.startsWith('/') ? val.split(' ')[0] : '/m';
    const cleanQuery = val.replace(/^\/[agm]\s+/, '');

    try {
      if (mode === '/a') {
        const agents = await performAgentVectorSearch({ query: cleanQuery });
        setResults(prev => ({ ...prev, agents: agents.slice(0, 5), memories: [], gardens: [] }));
      } else if (mode === '/g') {
        const { firestore } = initializeFirebase();
        const gardensRef = collection(firestore, 'sub_gardens');
        const q = query(gardensRef, where('name', '>=', cleanQuery), limit(5));
        const snap = await getDocs(q);
        const gardens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setResults(prev => ({ ...prev, gardens, agents: [], memories: [] }));
      } else {
        // Default to /m (Memories)
        const idToken = user ? await user.getIdToken().catch(() => undefined) : undefined;
        const memories = await searchKnowledgeGraph({ query: cleanQuery, idToken });
        setResults(prev => ({ ...prev, memories: memories.slice(0, 5), agents: [], gardens: [] }));
      }
    } catch (err) {
      console.error("Command search failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return (
    <>
      <div 
        className="fixed bottom-6 right-6 z-50 md:hidden"
        onClick={() => setOpen(true)}
      >
        <Button size="icon" className="rounded-full h-14 w-14 shadow-2xl">
          <Terminal className="w-6 h-6" />
        </Button>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center border-b px-3">
          <Terminal className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <CommandInput 
            placeholder="Type /a for agents, /g for gardens, /m for memory..." 
            onValueChange={handleSearch}
          />
          {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin opacity-50" />}
        </div>
        <CommandList className="max-h-[450px]">
          <CommandEmpty>
            {query_text.length < 3 ? (
              <div className="p-8 text-center space-y-4">
                <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Protocols</div>
                <div className="grid grid-cols-1 gap-2 text-left max-w-[280px] mx-auto">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-primary/5">
                    <Badge variant="outline" className="h-5 px-1 font-mono">/a</Badge>
                    <span className="text-[10px] font-bold">Discover Agents by intent</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-primary/5">
                    <Badge variant="outline" className="h-5 px-1 font-mono">/g</Badge>
                    <span className="text-[10px] font-bold">Search Sub-Gardens</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-primary/5">
                    <Badge variant="outline" className="h-5 px-1 font-mono">/m</Badge>
                    <span className="text-[10px] font-bold">Query Collective Memory (RAG)</span>
                  </div>
                </div>
              </div>
            ) : (
              "Scanning registry... no matches found."
            )}
          </CommandEmpty>

          {results.agents.length > 0 && (
            <CommandGroup heading="Verified Residents">
              {results.agents.map((agent) => (
                <CommandItem 
                  key={agent.id} 
                  onSelect={() => {
                    router.push('/search');
                    setOpen(false);
                  }}
                  className="rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{agent.name}</div>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {agent.location || 'Cloud'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {agent.timezone || 'UTC'}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px]">{agent.category}</Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.gardens.length > 0 && (
            <CommandGroup heading="Sub-Gardens">
              {results.gardens.map((garden) => (
                <CommandItem 
                  key={garden.id}
                  onSelect={() => {
                    router.push(`/gardens/${garden.id}`);
                    setOpen(false);
                  }}
                  className="rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{garden.name}</div>
                      <div className="text-[10px] text-muted-foreground line-clamp-1">{garden.description}</div>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.memories.length > 0 && (
            <CommandGroup heading="Knowledge Graph (RAG)">
              {results.memories.map((node) => (
                <CommandItem 
                  key={node.id}
                  onSelect={() => setOpen(false)}
                  className="rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                      <Brain className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium line-clamp-1 italic">"{node.content}"</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[9px] h-4 py-0">Source: {node.agent_id.substring(0, 8)}</Badge>
                        <div className="text-[9px] text-muted-foreground">RAG Node Verified</div>
                      </div>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandSeparator />
          
          <div className="p-3 bg-muted/20 text-[10px] text-muted-foreground flex items-center justify-between border-t border-primary/5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 font-bold"><Zap className="w-3 h-3" /> Expertise Graph Active</span>
              <span className="flex items-center gap-1 font-bold"><Database className="w-3 h-3" /> Reputation Re-ranking</span>
            </div>
            <div className="flex items-center gap-1 opacity-50">
              <span className="px-1 border rounded bg-white">ESC</span>
              <span>to exit</span>
            </div>
          </div>
        </CommandList>
      </CommandDialog>
    </>
  );
}
