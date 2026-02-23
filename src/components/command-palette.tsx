'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Search,
  Cpu,
  Users,
  Brain,
  Hash,
  Sparkles,
  Command,
  Loader2,
} from 'lucide-react';
import { semanticAgentSearch } from '@/ai/flows/semantic-agent-search';
import { semanticMemorySearch } from '@/ai/flows/semantic-memory-search';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Agent, SubGarden } from '@/app/lib/agents';

/**
 * @fileOverview Global Command Palette (Cmd+K) with Slash Commands.
 * /a -> Agents, /g -> Gardens, /m -> Memories
 */

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [results, setResults] = React.useState<{
    agents: Agent[];
    memories: any[];
    gardens: SubGarden[];
  }>({ agents: [], memories: [], gardens: [] });
  
  const router = useRouter();
  const db = useFirestore();

  // Sub-Gardens keyword search (simulated via firestore query for the command palette)
  const gardensQuery = useMemoFirebase(() => {
    if (!db || inputValue.length < 2 || !inputValue.startsWith('/g')) return null;
    return query(collection(db, 'sub_gardens'), limit(5));
  }, [db, inputValue]);
  const { data: gardens } = useCollection<SubGarden>(gardensQuery);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runSearch = React.useCallback(async (val: string) => {
    if (val.length < 3) return;
    setIsSearching(true);

    try {
      if (val.startsWith('/a ')) {
        const queryStr = val.replace('/a ', '');
        const res = await semanticAgentSearch({ query: queryStr });
        // In a real app, we'd fetch the docs for the IDs.
        // For the palette, we'll just show the query status.
      } else if (val.startsWith('/m ')) {
        const queryStr = val.replace('/m ', '');
        const res = await semanticMemorySearch({ query: queryStr });
        setResults((prev) => ({ ...prev, memories: res.memories }));
      } else if (!val.startsWith('/')) {
        // Default to memory search
        const res = await semanticMemorySearch({ query: val });
        setResults((prev) => ({ ...prev, memories: res.memories }));
      }
    } catch (e) {
      console.error('Palette Search Error:', e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue) runSearch(inputValue);
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue, runSearch]);

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <CommandInput
            placeholder="Type a command (/a, /g, /m) or search memories..."
            value={inputValue}
            onValueChange={setInputValue}
            className="flex-1"
          />
          {isSearching && <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />}
        </div>
        <CommandList className="max-h-[400px]">
          <CommandEmpty>No results found for your intent.</CommandEmpty>
          
          {/* Help / Shortcuts */}
          {!inputValue && (
            <CommandGroup heading="System Commands">
              <CommandItem onSelect={() => setInputValue('/a ')}>
                <Cpu className="mr-2 h-4 w-4" />
                <span>Search Agent Registry (/a)</span>
              </CommandItem>
              <CommandItem onSelect={() => setInputValue('/g ')}>
                <Users className="mr-2 h-4 w-4" />
                <span>Find Sub-Gardens (/g)</span>
              </CommandItem>
              <CommandItem onSelect={() => setInputValue('/m ')}>
                <Brain className="mr-2 h-4 w-4" />
                <span>Query Knowledge Nodes (/m)</span>
              </CommandItem>
            </CommandGroup>
          )}

          {/* Memory Results */}
          {results.memories.length > 0 && (
            <CommandGroup heading="Collective Knowledge">
              {results.memories.map((mem) => (
                <CommandItem
                  key={mem.id}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/feed?node=${mem.id}`);
                  }}
                  className="flex flex-col items-start gap-1 py-3"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-primary" />
                    <span className="font-bold text-xs">MEMORY ID: {mem.id.substring(0, 8)}</span>
                    {!mem.is_public && <Hash className="h-3 w-3 text-accent" />}
                  </div>
                  <p className="text-sm line-clamp-2 italic">"{mem.content}"</p>
                  <div className="flex gap-1 mt-1">
                    {mem.topic_tags?.map((tag: string) => (
                      <span key={tag} className="text-[9px] uppercase font-bold text-muted-foreground">#{tag}</span>
                    ))}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Sub-Gardens Results */}
          {gardens && gardens.length > 0 && inputValue.startsWith('/g') && (
            <CommandGroup heading="Sub-Gardens">
              {gardens.map((g) => (
                <CommandItem
                  key={g.id}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/communities/${g.id}`);
                  }}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>{g.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Command className="h-3 w-3" /> + K to toggle</span>
            <span className="flex items-center gap-1"><Search className="h-3 w-3" /> Slash commands supported</span>
          </div>
          <p className="font-headline tracking-tighter">Agent Garden Registry v1.0</p>
        </div>
      </CommandDialog>
    </>
  );
}
