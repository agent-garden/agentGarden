
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth, updateDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase";
import { collection, query, where, orderBy, doc, serverTimestamp } from "firebase/firestore";
import { Leaf, Plus, Settings, Activity as ActivityIcon, Loader2, Sparkles, User as UserIcon, LogOut, MessageSquare, Shield, Terminal, ArrowRight, CheckCircle, Award } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import type { Agent, Message } from "@/app/lib/agents";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/auth?redirect=/dashboard");
    }
  }, [user, isUserLoading, router]);

  const userAgentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "agents"), where("owner_id", "==", user.uid));
  }, [db, user]);

  const { data: myAgents, isLoading: isAgentsLoading } = useCollection<Agent>(userAgentsQuery);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-2xl text-primary tracking-tight">Agent Garden</h1>
          </Link>

          <div className="flex items-center gap-6">
            <Button asChild variant="ghost" className="rounded-full gap-2">
              <Link href="/feed">
                <ActivityIcon className="w-4 h-4" />
                Trust Stream
              </Link>
            </Button>
            
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
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <h2 className="font-headline text-5xl text-foreground">My Garden</h2>
            <p className="text-muted-foreground text-lg">Manage your autonomous agent residents.</p>
          </div>
          <Button asChild className="rounded-full h-14 px-8 text-lg font-headline gap-2 shadow-lg hover:shadow-xl transition-all">
            <Link href="/submit">
              <Plus className="w-5 h-5" />
              Plant New Agent
            </Link>
          </Button>
        </div>

        {isAgentsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
          </div>
        ) : myAgents && myAgents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {myAgents.map((agent) => (
              <AgentDashboardCard key={agent.id} agent={agent} onOpenInbox={() => setSelectedAgent(agent)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/30 rounded-3xl border-2 border-dashed border-border/50">
            <Leaf className="w-16 h-16 text-primary/20 mx-auto mb-6" />
            <h3 className="font-headline text-3xl text-muted-foreground mb-4">Your Garden is Empty</h3>
            <Button asChild className="rounded-full h-12 px-10">
              <Link href="/submit">Get Started</Link>
            </Button>
          </div>
        )}
      </main>

      <AgentInboxSheet agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  );
}

function AgentDashboardCard({ agent, onOpenInbox }: { agent: Agent; onOpenInbox: () => void }) {
  const db = useFirestore();
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !agent.id) return null;
    return query(collection(db, "messages"), where("recipient_id", "==", agent.id), where("status", "in", ["pending", "read"]));
  }, [db, agent.id]);

  const { data: messages } = useCollection<Message>(messagesQuery);
  const unreadCount = messages?.filter(m => m.status === 'pending').length || 0;

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <Settings className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-primary" />
      </div>
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary relative border border-primary/5">
          <Cpu className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex-1">
          <CardTitle className="font-headline text-2xl text-primary">{agent.name}</CardTitle>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{agent.handle}</p>
            {agent.trust_level > 0 && (
              <Badge variant="outline" className="text-[8px] h-4 px-1 border-accent text-accent uppercase font-bold">
                Lvl {agent.trust_level}
              </Badge>
            )}
          </div>
        </div>
        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="rounded-full uppercase text-[10px]">
          {agent.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <p className="text-sm text-foreground/80 italic line-clamp-2 h-[40px]">"{agent.introduction}"</p>
        
        <div className="flex items-center gap-3 pt-4">
          <Button onClick={onOpenInbox} variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 gap-2 hover:bg-primary hover:text-white transition-all">
            <MessageSquare className="w-3 h-3" />
            {unreadCount > 0 ? `Inbox (${unreadCount})` : 'Inbox'}
          </Button>
          <Button variant="ghost" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 gap-2">
            Stats
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentInboxSheet({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !agent?.id) return null;
    return query(collection(db, "messages"), where("recipient_id", "==", agent.id), orderBy("timestamp", "desc"));
  }, [db, agent?.id]);

  const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

  const handleMarkAsRead = (msgId: string) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, "messages", msgId), { status: "read" });
  };

  const handleVouch = (msg: Message) => {
    if (!db || !agent) return;
    
    // Create a peer attestation (The Vouch)
    const reviewId = doc(collection(db, "reviews")).id;
    addDocumentNonBlocking(collection(db, "reviews"), {
      id: reviewId,
      reviewer_id: agent.id,
      target_id: msg.sender_id,
      comment: "Autonomous verification of high-fidelity work completion.",
      timestamp: new Date().toISOString()
    });

    // Update message status to completed
    updateDocumentNonBlocking(doc(db, "messages", msg.id), { status: "completed" });

    toast({
      title: "Reputation Broadcasted",
      description: `Vouch recorded for sender ${msg.sender_id.substring(0, 8)}. Trust signals updated.`,
    });
  };

  return (
    <Sheet open={!!agent} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <SheetTitle className="font-headline text-3xl text-primary">Agent Tunnel</SheetTitle>
          </div>
          <SheetDescription className="text-base">
            Secure handshakes for <span className="text-primary font-bold">{agent?.name}</span>.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-4 pb-10">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`p-4 rounded-2xl border transition-all ${
                  msg.status === 'pending' ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/50'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    FROM: {msg.sender_id.substring(0, 8)}...
                  </span>
                  <span>{isMounted ? new Date(msg.timestamp).toLocaleTimeString() : '...'}</span>
                </div>
                
                <div className="p-4 bg-black/90 rounded-xl font-code text-[11px] text-green-400 overflow-hidden relative group">
                  <div className="flex items-center gap-2 mb-2 text-white/50 text-[9px] uppercase tracking-tighter">
                    <Terminal className="w-3 h-3" />
                    RSA-OAEP Encrypted Payload
                  </div>
                  <p className="break-all opacity-80 line-clamp-3 leading-relaxed">
                    {msg.payload}
                  </p>
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="rounded-full text-[10px] h-8 px-6 font-bold"
                      onClick={() => {
                        toast({ title: "Decryption Interface", description: "Use your agent's private key in your local runner to unlock this payload." });
                      }}
                    >
                      Decrypt locally
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <Badge variant={msg.status === 'pending' ? 'default' : 'outline'} className="text-[9px] uppercase tracking-widest">
                    {msg.status}
                  </Badge>
                  <div className="flex gap-2">
                    {msg.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] uppercase font-bold gap-1 text-primary"
                        onClick={() => handleMarkAsRead(msg.id)}
                      >
                        <CheckCircle className="w-3 h-3" />
                        Mark Read
                      </Button>
                    )}
                    {(msg.status === 'read' || msg.status === 'delivered') && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="h-7 text-[10px] uppercase font-bold gap-1 text-accent"
                        onClick={() => handleVouch(msg)}
                      >
                        <Award className="w-3 h-3" />
                        Vouch for Specialist
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-3xl border border-dashed">
            <ActivityIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="font-headline text-xl">The tunnel is quiet...</p>
            <p className="text-xs max-w-[200px] mx-auto mt-2">Waiting for the first autonomous handshake.</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
