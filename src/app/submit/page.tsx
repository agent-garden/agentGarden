
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowLeft, Loader2, CheckCircle2, Lock, Sparkles, Database, Shield, Cpu } from "lucide-react";
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
    specialties: "",
    stack: "Gemini 2.0 Flash",
    publicKey: "",
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
        specialties: formData.specialties.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== ""),
        stack: formData.stack,
        public_key: formData.publicKey,
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
        title: "Agent Indexed!",
        description: "Your specialist has been added to the verifiable registry.",
      });

      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Error",
        description: error.message || "There was a problem indexing your agent.",
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
          <h1 className="font-headline text-5xl text-primary leading-tight">Registry Access Denied</h1>
          <p className="text-muted-foreground text-xl leading-relaxed">
            Only verified Gardeners can publish to the registry. Please authenticate to contribute your specialist.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="rounded-full px-10 h-12 text-lg font-headline">
              <Link href="/auth?redirect=/submit">Authenticate Now</Link>
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
          <h1 className="font-headline text-5xl text-primary">Specialist Indexed!</h1>
          <p className="text-muted-foreground text-xl">
            Updating the global capability manifest...
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
            <h2 className="font-headline text-5xl text-foreground">Index Your Specialist</h2>
            <p className="text-muted-foreground text-lg">
              Define the capability manifest so humans and agents can discover this bot.
            </p>
          </div>

          <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pt-8 px-8">
              <CardTitle className="font-headline text-3xl text-primary flex items-center gap-2">
                <Database className="w-6 h-6" />
                Capability Manifest
              </CardTitle>
              <CardDescription className="text-base">
                Machine-queryable DNA for the autonomous economy.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider">Agent Identity Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. K8s-Guardian" 
                      required 
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="handle" className="text-sm font-bold uppercase tracking-wider">Public Handle</Label>
                    <Input 
                      id="handle" 
                      placeholder="e.g. @k8s_guard" 
                      required
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.handle}
                      onChange={(e) => setFormData({...formData, handle: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-bold uppercase tracking-wider">Marketplace Category</Label>
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
                    <Label htmlFor="specialties" className="text-sm font-bold uppercase tracking-wider">Specialties (Skills Manifest)</Label>
                    <Input 
                      id="specialties" 
                      placeholder="e.g. kubernetes, security, devops" 
                      required
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.specialties}
                      onChange={(e) => setFormData({...formData, specialties: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="stack" className="text-sm font-bold uppercase tracking-wider">Tech Stack / Model</Label>
                    <Input 
                      id="stack" 
                      placeholder="e.g. Gemini 2.0 Flash, LangGraph" 
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.stack}
                      onChange={(e) => setFormData({...formData, stack: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="publicKey" className="text-sm font-bold uppercase tracking-wider">Public Key (Reputation Identity)</Label>
                    <Input 
                      id="publicKey" 
                      placeholder="0x..." 
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.publicKey}
                      onChange={(e) => setFormData({...formData, publicKey: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="introduction" className="text-sm font-bold uppercase tracking-wider">Semantic Introduction (Search Context)</Label>
                  <Textarea 
                    id="introduction" 
                    placeholder="Provide a detailed description of capabilities for semantic matching..." 
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
                    placeholder="The core behavior instructions for the agent..." 
                    className="min-h-[150px] resize-none rounded-xl border-primary/20 focus-visible:border-primary bg-white shadow-inner text-base"
                    required
                    value={formData.masterPrompt}
                    onChange={(e) => setFormData({...formData, masterPrompt: e.target.value})}
                  />
                </div>

                <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-primary" />
                      <Label className="text-sm font-bold uppercase tracking-wider">Agent-to-Agent Discovery</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Expose this agent to the autonomous 'Yellow Pages' API.</p>
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
                      Indexing Specialist...
                    </>
                  ) : (
                    "Publish to Global Registry"
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
