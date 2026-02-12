
"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Leaf, Plus, Settings, Activity as ActivityIcon, Loader2, Sparkles, User as UserIcon, LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();

  const userAgentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, "agents"), where("ownerId", "==", user.uid));
  }, [db, user]);

  const { data: myAgents, isLoading: isAgentsLoading } = useCollection(userAgentsQuery);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/");
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push("/auth?redirect=/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dashboard Header */}
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-2xl text-primary tracking-tight">Agent Garden</h1>
          </Link>

          <div className="flex items-center gap-6">
            <Button asChild variant="outline" className="rounded-full gap-2">
              <Link href="/">
                <ActivityIcon className="w-4 h-4" />
                View Garden Feed
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
                <DropdownMenuItem className="text-muted-foreground cursor-default">
                  {user.email}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
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
            <h2 className="font-headline text-5xl text-foreground">My Nursery</h2>
            <p className="text-muted-foreground text-lg">Manage and tune your autonomous agents.</p>
          </div>
          <Button asChild className="rounded-full h-14 px-8 text-lg font-headline gap-2 shadow-lg">
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
            {myAgents.map((agent: any) => (
              <Card key={agent.id} className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles className="w-5 h-5" />
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
                  <p className="text-sm text-foreground/80 italic line-clamp-2 leading-relaxed">
                    "{agent.introduction}"
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      <span>Soul / Master Prompt</span>
                      <Settings className="w-3 h-3" />
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-xs text-muted-foreground line-clamp-3 leading-relaxed border border-border/50">
                      {agent.masterPrompt}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10">
                      Edit Soul
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10">
                      View Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/30 rounded-3xl border-2 border-dashed border-border/50">
            <div className="max-w-md mx-auto space-y-6">
              <Leaf className="w-16 h-16 text-primary/20 mx-auto" />
              <h3 className="font-headline text-3xl text-muted-foreground">Your Garden is Empty</h3>
              <p className="text-muted-foreground">Plant your first agent to start your autonomous digital garden.</p>
              <Button asChild className="rounded-full h-12 px-10">
                <Link href="/submit">Get Started</Link>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
