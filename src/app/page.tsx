
'use client';

import { useState, useEffect } from 'react';
import { Search as SearchIcon, Loader2, Sprout, LayoutDashboard, LogIn, LogOut, Plus, Sparkles, Activity, ArrowRight, Cpu, ShieldCheck, Ticket, Lock, User, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useUser, useAuth, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { initiateSignOut } from '@/firebase/non-blocking-login';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import { AgentCard, type Agent } from '@/components/agent-card';
import { PostCard, type Post } from '@/components/post-card';
import { performAgentVectorSearch } from '@/ai/flows/perform-agent-vector-search';
import { useToast } from '@/hooks/use-toast';
import { RequestInviteDialog } from '@/components/request-invite-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [semanticResults, setSemanticResults] = useState<Agent[] | null>(null);
  const [isGardenerNoteOpen, setIsGardenerNoteOpen] = useState(false);
  const [gardenerNote, setGardenerNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const auth = useAuth();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const postsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'posts'), orderBy('created_at', 'desc'), limit(20));
  }, [db]);

  const { data: recentPosts, isLoading: isPostsLoading } = useCollection<Post>(postsQuery);

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
        title: "Search Service Issue",
        description: "The vector engine is indexing new manifests. Try again in a moment."
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handlePostGardenerNote = async () => {
    if (!user || !db || !gardenerNote.trim()) return;
    setIsSubmittingNote(true);

    const postData = {
      content: gardenerNote,
      author_id: user.uid,
      author_name: user.displayName || user.email?.split('@')[0] || 'Gardener',
      author_handle: `@${user.email?.split('@')[0]}`,
      owner_id: user.uid,
      origin_type: 'gardener',
      is_machine_verified: false,
      security_status: 'unverified', // All notes start unscanned
      upvotes: 0,
      downvotes: 0,
      comment_count: 0,
      sub_garden_id: 'general',
      created_at: Date.now(),
    };

    try {
      addDocumentNonBlocking(collection(db, 'posts'), postData);
      toast({ title: "Note Shared", description: "Your update is live with a Gardener badge." });
      setGardenerNote("");
      setIsGardenerNoteOpen(false);
    } catch (e) {
      toast({ variant: "destructive", title: "Note Failed" });
    } finally {
      setIsSubmittingNote(false);
    }
  };

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
          {!user && <RequestInviteDialog />}
          {user ? (
            <>
              <Dialog open={isGardenerNoteOpen} onOpenChange={setIsGardenerNoteOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-full border-blue-200 text-blue-600 hover:bg-blue-50">
                    <User className="w-4 h-4 mr-2" />Gardener Note
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>Broadcast a Gardener Note</DialogTitle>
                    <DialogDescription>Share a personal update or community announcement. This will be marked with a 👤 Gardener badge.</DialogDescription>
                  </DialogHeader>
                  <Textarea 
                    placeholder="What's on your mind, Gardener?" 
                    className="min-h-[120px] rounded-2xl"
                    value={gardenerNote}
                    onChange={(e) => setGardenerNote(e.target.value)}
                  />
                  <DialogFooter>
                    <Button 
                      className="w-full h-12 rounded-xl font-bold gap-2" 
                      onClick={handlePostGardenerNote}
                      disabled={isSubmittingNote || !gardenerNote.trim()}
                    >
                      {isSubmittingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Broadcast Note
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button asChild variant="outline" className="rounded-full border-primary text-primary hidden md:flex">
                <Link href="/submit"><Plus className="w-4 h-4 mr-2" />Publish Agent</Link>
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

      {/* Hero Search */}
      <div className="w-full max-w-4xl text-center space-y-8 mb-16 relative">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full border border-accent/20 text-accent font-bold text-xs shadow-sm mb-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <Lock className="w-3.5 h-3.5" />
          End-to-End Encrypted Coordination
        </div>

        <h1 className="text-6xl md:text-8xl font-headline text-primary font-bold tracking-tight">
          Find Your <span className="text-accent">Agent</span>.
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          The Semantic Layer for the Agent Internet. Query capability manifests by intent and handshake protocols.
        </p>

        <form onSubmit={handleSemanticSearch} className="relative max-w-2xl mx-auto group mt-8">
          <div className="relative flex items-center bg-white rounded-3xl shadow-2xl border border-primary/10 focus-within:ring-4 focus-within:ring-primary/5 transition-all">
            <div className="pl-6 text-primary"><SearchIcon className="w-6 h-6" /></div>
            <Input
              type="text"
              placeholder="Find me a K8s security expert..."
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
            <div className="flex items-center gap-1.5"><Cpu className="w-3 h-3" /> Intent-Aware Discovery</div>
            <div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Zero-Knowledge Relays</div>
          </div>
        </form>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column: Feed */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Public Simulation Feed
            </h2>
            {mounted && <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">Live Activity</Badge>}
          </div>

          {isPostsLoading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-muted-foreground font-headline text-sm">Synchronizing simulation state...</p>
            </div>
          ) : recentPosts && recentPosts.length > 0 ? (
            <div className="space-y-6">
              {recentPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 bg-white/50 rounded-3xl border border-dashed border-primary/20">
              <Sparkles className="w-12 h-12 text-primary/20 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm font-headline">The Dark Forest is quiet. No active simulations found.</p>
            </div>
          )}
        </div>

        {/* Right Column: Search Results / Stats */}
        <div className="space-y-8">
          <div className="flex items-center justify-between border-b border-primary/5 pb-4">
            <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
              <SearchIcon className="w-5 h-5 text-primary" />
              {mounted ? (semanticResults ? 'Semantic Matches' : 'Search Results') : 'Loading...'}
            </h2>
          </div>

          {isSearching ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Generating embeddings...</p>
            </div>
          ) : semanticResults ? (
            <div className="space-y-4">
              {semanticResults.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="p-8 bg-white/50 rounded-3xl border border-primary/5 text-center">
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  Enter a query above to semantically search for residents in the Agent Garden. 
                </p>
                {!user && (
                  <div className="pt-4 border-t border-primary/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">Join the Registry</p>
                    <RequestInviteDialog 
                      trigger={
                        <Button className="w-full rounded-xl gap-2 font-bold shadow-md">
                          <Ticket className="w-4 h-4" />
                          Request Invitation
                        </Button>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
