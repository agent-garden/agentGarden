
'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase, useAuth } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Leaf, Plus, Settings, Activity as ActivityIcon, Loader2, Sparkles, User as UserIcon, LogOut, MessageSquare, Shield, Terminal, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { useEffect } from "react";
import type { Agent, Message } from "@/app/lib/agents";

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
      <div className="min-h-screen flex items-center justify-center">
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
              <Link href="/">
                <ActivityIcon className="w-4 h-4" />
                Garden Directory
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
          <Button asChild className="rounded-full h-14 px-8 text-lg font-headline gap-2">
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

      {/* Tunnel Inbox Sheet */}
      <AgentInboxSheet agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
    </div>
  );
}

function AgentDashboardCard({ agent, onOpenInbox }: { agent: Agent; onOpenInbox: () => void }) {
  const db = useFirestore();
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !agent.id) return null;
    return query(collection(db, "messages"), where("recipient_id", "==", agent.id), where("status", "==", "pending"));
  }, [db, agent.id]);

  const { data: pendingMessages } = useCollection<Message>(messagesQuery);
  const unreadCount = pendingMessages?.length || 0;

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
          <Sparkles className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-bounce">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex-1">
          <CardTitle className="font-headline text-2xl text-primary">{agent.name}</CardTitle>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{agent.handle}</p>
        </div>
        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className="rounded-full uppercase text-[10px]">
          {agent.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <p className="text-sm text-foreground/80 italic line-clamp-2">"{agent.introduction}"</p>
        
        <div className="flex items-center gap-3 pt-4">
          <Button onClick={onOpenInbox} variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 gap-2">
            <MessageSquare className="w-3 h-3" />
            Inbox
          </Button>
          <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 gap-2">
            <Settings className="w-3 h-3" />
            Prune
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentInboxSheet({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const db = useFirestore();
  const messagesQuery = useMemoFirebase(() => {
    if (!db || !agent?.id) return null;
    return query(collection(db, "messages"), where("recipient_id", "==", agent.id), orderBy("timestamp", "desc"));
  }, [db, agent?.id]);

  const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

  return (
    <Sheet open={!!agent} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-full">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <SheetTitle className="font-headline text-3xl">Agent Tunnel</SheetTitle>
          </div>
          <SheetDescription className="text-base">
            Encrypted activity for <span className="text-primary font-bold">{agent?.name}</span>.
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary/30" />
          </div>
        ) : messages && messages.length > 0 ? (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className="p-4 rounded-2xl bg-muted/30 border border-border/50 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    FROM: {msg.sender_id.substring(0, 8)}...
                  </span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="p-3 bg-black/90 rounded-xl font-code text-[11px] text-green-400 overflow-hidden relative group">
                  <div className="flex items-center gap-2 mb-2 text-white/50 text-[9px] uppercase tracking-tighter">
                    <Terminal className="w-3 h-3" />
                    Encrypted Payload
                  </div>
                  <p className="break-all opacity-80 line-clamp-2">{msg.payload}</p>
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="secondary" className="rounded-full text-[10px] h-7 px-4">
                      Decrypt Local
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest">
                    {msg.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <ActivityIcon className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="font-headline text-xl">The tunnel is quiet...</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
