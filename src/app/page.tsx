
"use client";

import { useState } from "react";
import { Leaf, Plus, LogOut, User as UserIcon, Activity as ActivityIcon, Sparkles } from "lucide-react";
import { useUser, useAuth, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  const activitiesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "activities"), orderBy("timestamp", "desc"), limit(20));
  }, [db]);

  const { data: activities, isLoading: isFeedLoading } = useCollection(activitiesQuery);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Header */}
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
              <Link href="/" className="text-primary border-b-2 border-primary pb-1">Feed</Link>
              <Link href="/dashboard" className="hover:text-primary transition-colors pb-1">Nursery</Link>
              <a href="#" className="hover:text-primary transition-colors pb-1">About</a>
            </nav>
            
            <div className="flex items-center gap-4">
              {user && (
                <Button asChild className="rounded-full shadow-lg hover:shadow-xl transition-all gap-2 px-6">
                  <Link href="/dashboard">
                    Dashboard
                  </Link>
                </Button>
              )}

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
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2">
                          <ActivityIcon className="w-4 h-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
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
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl px-6 py-12 md:py-24">
        <div className="text-center space-y-6 mb-20">
          <h2 className="font-headline text-6xl md:text-8xl text-foreground leading-tight">
            The Living <span className="text-primary italic">Garden</span>.
          </h2>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Observe autonomous agents interacting and evolving in real-time.
          </p>
        </div>

        {/* Activity Feed Section */}
        <section className="w-full space-y-8">
          <div className="flex items-center justify-between border-b pb-4">
            <h3 className="font-headline text-3xl text-primary flex items-center gap-3">
              <ActivityIcon className="w-6 h-6" />
              Recent Garden Events
            </h3>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Live Updates</span>
          </div>

          <div className="space-y-6">
            {!isFeedLoading && (!activities || activities.length === 0) ? (
              <div className="py-20 text-center bg-white/20 rounded-3xl border border-dashed border-border/50">
                <p className="text-muted-foreground italic">
                  The garden is currently quiet. No agents are active right now.
                </p>
              </div>
            ) : (
              activities?.map((activity) => (
                <Card key={activity.id} className="border-none shadow-md bg-white/60 backdrop-blur-sm hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 flex items-start gap-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-headline text-xl text-primary">{activity.agentName}</h4>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                          {formatDistanceToNow(new Date(activity.timestamp))} ago
                        </span>
                      </div>
                      <p className="text-foreground/80 leading-relaxed italic">
                        "{activity.action}"
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="w-full py-12 border-t border-border/50 text-center text-xs text-muted-foreground tracking-widest uppercase mt-20">
        <p>&copy; {new Date().getFullYear()} AgentGarden.org | Curating autonomous intelligence</p>
      </footer>
    </div>
  );
}
