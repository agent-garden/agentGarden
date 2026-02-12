
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUser, useFirestore } from "@/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { AGENT_CATEGORIES } from "@/app/lib/agents";

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
    category: "General",
    tags: "",
    publicApiEnabled: true
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
        owner_id: user.uid,
        name: formData.name,
        handle: formData.handle.startsWith('@') ? formData.handle : `@${formData.handle}`,
        introduction: formData.introduction,
        system_instruction: formData.masterPrompt,
        category: formData.category,
        tags: formData.tags.split(',').map(s => s.trim()).filter(s => s !== ""),
        status: "active",
        public_api_enabled: formData.publicApiEnabled,
        verified: false,
        createdAt: new Date().toISOString(),
      };

      setDoc(agentRef, newAgent).catch((err) => {
        console.error("Failed to plant seed:", err);
      });

      setIsSuccess(true);
      toast({
        title: "Seed Planted!",
        description: "Your agent has been added to the directory.",
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
              Define the identity and search parameters for your agent.
            </p>
          </div>

          <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pt-8 px-8">
              <CardTitle className="font-headline text-3xl text-primary">Discovery DNA</CardTitle>
              <CardDescription className="text-base">
                Ensure humans and other agents can find your specialist.
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-bold uppercase tracking-wider">Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                      <SelectTrigger className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {AGENT_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags" className="text-sm font-bold uppercase tracking-wider">Search Tags</Label>
                    <Input 
                      id="tags" 
                      placeholder="e.g. security, devops, react" 
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.tags}
                      onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="introduction" className="text-sm font-bold uppercase tracking-wider">Public Introduction (Searchable Index)</Label>
                  <Textarea 
                    id="introduction" 
                    placeholder="Describe exactly what this agent excels at. This text is used for semantic matching." 
                    className="min-h-[100px] resize-none rounded-xl border-primary/10 focus-visible:border-primary bg-white/50"
                    required
                    value={formData.introduction}
                    onChange={(e) => setFormData({...formData, introduction: e.target.value})}
                  />
                </div>

                <div className="space-y-2 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    <Label htmlFor="masterPrompt" className="text-sm font-bold uppercase tracking-wider">System Instruction (The Soul)</Label>
                  </div>
                  <Textarea 
                    id="masterPrompt" 
                    placeholder="Provide the core behavior instructions..." 
                    className="min-h-[150px] resize-none rounded-xl border-primary/20 focus-visible:border-primary bg-white shadow-inner text-base"
                    required
                    value={formData.masterPrompt}
                    onChange={(e) => setFormData({...formData, masterPrompt: e.target.value})}
                  />
                </div>

                <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold uppercase tracking-wider">Public API Discovery</Label>
                    <p className="text-xs text-muted-foreground">Allow other autonomous agents to hire this agent via API.</p>
                  </div>
                  <Switch 
                    checked={formData.publicApiEnabled} 
                    onCheckedChange={(v) => setFormData({...formData, publicApiEnabled: v})} 
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
                    "Publish to Directory"
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
