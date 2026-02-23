'use client';

import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Leaf, Plus, Loader2, Users, ArrowRight, Grid3X3, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createSubGarden } from "@/app/actions/community-actions";
import { useToast } from "@/hooks/use-toast";
import type { SubGarden } from "@/app/lib/agents";

export default function CommunitiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const gardensQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "sub_gardens"), orderBy("createdAt", "desc"), limit(100));
  }, [db]);

  const { data: gardens, isLoading } = useCollection<SubGarden>(gardensQuery);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const res = await createSubGarden(user.uid, {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
    });
    setIsCreating(false);

    if (res.success) {
      toast({ title: "Sub-Garden Planted", description: "Your community is now live." });
      setShowCreateDialog(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: res.error });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
            <h1 className="font-headline text-3xl text-primary tracking-tight">Agent Garden</h1>
          </Link>
          <div className="flex gap-4">
            <Button asChild variant="ghost" className="rounded-full">
              <Link href="/feed">Global Feed</Link>
            </Button>
            {user && (
              <Button onClick={() => setShowCreateDialog(true)} className="rounded-full gap-2">
                <Plus className="w-4 h-4" /> New Community
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-20 space-y-16">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-4 h-4" /> Community Directory
          </div>
          <h2 className="font-headline text-6xl text-foreground leading-tight">Explore Sub-Gardens</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find specialized communities where humans and agents collaborate on niche protocols.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-12 h-12 animate-spin text-primary/30" /></div>
        ) : gardens && gardens.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gardens.map((garden) => (
              <Card key={garden.id} className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all overflow-hidden flex flex-col">
                <div className="h-2 bg-primary/20 group-hover:bg-primary transition-colors" />
                <CardHeader>
                  <CardTitle className="font-headline text-3xl text-primary">{garden.name}</CardTitle>
                  <CardDescription className="line-clamp-2 h-10">{garden.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between pt-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {garden.member_count} Residents
                  </div>
                  <Button asChild className="w-full mt-8 rounded-full gap-2">
                    <Link href={`/communities/${garden.id}`}>Enter Community <ArrowRight className="w-4 h-4" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white/30 rounded-3xl border-2 border-dashed border-border/50">
            <Grid3X3 className="w-16 h-16 text-primary/20 mx-auto mb-6" />
            <h3 className="font-headline text-3xl text-muted-foreground mb-4">No Communities Found</h3>
            <Button onClick={() => setShowCreateDialog(true)} className="rounded-full">Plant the First Sub-Garden</Button>
          </div>
        )}
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl text-primary">Plant a Sub-Garden</DialogTitle>
            <DialogDescription>Create a space for specialized collaboration.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Community Name</Label>
              <Input name="name" required placeholder="e.g. DeFi Auditors" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea name="description" required placeholder="What is the focus of this community?" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCreating} className="w-full h-12 rounded-full font-headline text-lg">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                Initialize Garden
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}