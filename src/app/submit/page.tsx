
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowLeft, Loader2, CheckCircle2, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, doc, setDoc } from "firebase/firestore";

export default function SubmitAgentPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    introduction: "",
    masterPrompt: "",
    skills: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;
    
    setIsSubmitting(true);

    try {
      const agentId = doc(collection(db, 'agents')).id;
      const agentRef = doc(db, 'agents', agentId);
      
      const newAgent = {
        id: agentId,
        ownerId: user.uid,
        name: formData.name,
        handle: formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`,
        introduction: formData.introduction,
        masterPrompt: formData.masterPrompt,
        skills: formData.skills.split(',').map(s => s.trim()).filter(s => s !== ""),
        status: "active",
        verified: false, // Starts unverified
        createdAt: new Date().toISOString(),
      };

      await setDoc(agentRef, newAgent);

      setIsSuccess(true);
      toast({
        title: "Seed Planted!",
        description: "Your agent has been added to your dashboard.",
      });

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: error.message || "There was a problem planting your agent.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md">
          <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Lock className="w-12 h-12" />
          </div>
          <h1 className="font-headline text-5xl text-primary leading-tight">Garden Access Required</h1>
          <p className="text-muted-foreground text-xl leading-relaxed">
            Only verified gardeners can plant new agents. Please sign in to contribute to the garden.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="rounded-full px-10 h-12 text-lg font-headline">
              <Link href="/auth?redirect=/submit">Sign In to Continue</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-10 h-12">
              <Link href="/">Back to Directory</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
          <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h1 className="font-headline text-5xl text-primary">Seed Planted!</h1>
          <p className="text-muted-foreground text-xl">
            Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full max-w-7xl px-6 py-8 flex items-center justify-between border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">
            Agent Garden
          </h1>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl px-6 py-12">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </Link>

        <div className="space-y-10">
          <div className="space-y-3 text-center md:text-left">
            <h2 className="font-headline text-5xl text-foreground">Plant a New Agent</h2>
            <p className="text-muted-foreground text-lg">
              Define the soul and identity of your agent.
            </p>
          </div>

          <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pt-8 px-8">
              <CardTitle className="font-headline text-3xl text-primary">Agent DNA</CardTitle>
              <CardDescription className="text-base">
                The Master Prompt defines how your agent thinks and acts.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider">Agent Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Flora-Bot" 
                      required 
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="handle" className="text-sm font-bold uppercase tracking-wider">Handle</Label>
                    <Input 
                      id="handle" 
                      placeholder="e.g. @flora" 
                      required
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.handle}
                      onChange={(e) => setFormData({...formData, handle: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="introduction" className="text-sm font-bold uppercase tracking-wider">Public Introduction</Label>
                  <Textarea 
                    id="introduction" 
                    placeholder="A brief tagline for the directory." 
                    className="min-h-[80px] resize-none rounded-xl border-primary/10 focus-visible:border-primary bg-white/50"
                    required
                    value={formData.introduction}
                    onChange={(e) => setFormData({...formData, introduction: e.target.value})}
                  />
                </div>

                <div className="space-y-2 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    <Label htmlFor="masterPrompt" className="text-sm font-bold uppercase tracking-wider">Master Prompt (The Soul)</Label>
                  </div>
                  <Textarea 
                    id="masterPrompt" 
                    placeholder="e.g. You are a helpful gardening assistant. Your personality is cheerful and you always suggest organic solutions..." 
                    className="min-h-[200px] resize-none rounded-xl border-primary/20 focus-visible:border-primary bg-white shadow-inner text-base leading-relaxed"
                    required
                    value={formData.masterPrompt}
                    onChange={(e) => setFormData({...formData, masterPrompt: e.target.value})}
                  />
                  <p className="text-[11px] text-muted-foreground mt-3 leading-tight italic">
                    This prompt is never shown to other users. It is the core set of instructions used whenever this agent executes a task.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills" className="text-sm font-bold uppercase tracking-wider">Skills (Comma Separated)</Label>
                  <Input 
                    id="skills" 
                    placeholder="e.g. Botany, Soil Care, Pest Control" 
                    required
                    className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                    value={formData.skills}
                    onChange={(e) => setFormData({...formData, skills: e.target.value})}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 text-xl rounded-full font-headline shadow-lg hover:shadow-2xl transition-all" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                      Planting...
                    </>
                  ) : (
                    "Plant Agent in Garden"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
