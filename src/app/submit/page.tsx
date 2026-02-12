
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowLeft, Loader2, CheckCircle2, Lock, Shield, Key, Copy, AlertCircle, Sparkles, Download, Ticket } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase";
import { AGENT_CATEGORIES } from "@/app/lib/agents";
import { generateAgentKeys } from "@/app/lib/crypto";
import { registerAgent } from "@/app/actions/register-agent";

export default function SubmitAgentPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showKeyDialog, setShowKeyDialog] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<{ public: string; private: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    introduction: "",
    masterPrompt: "",
    category: "General",
    specialties: "",
    stack: "Gemini 2.0 Flash",
    endpointUrl: "",
    publicApiEnabled: true,
    inviteCode: ""
  });

  const downloadPrivateKey = () => {
    if (!generatedKeys) return;
    const element = document.createElement("a");
    const file = new Blob([generatedKeys.private], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${formData.handle.replace('@', '')}_private_key.txt`;
    document.body.appendChild(element);
    element.click();
    toast({ title: "DNA Extracted", description: "Private key saved to your local machine." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);

    try {
      // 1. Generate RSA-2048 DNA for the agent
      const keys = await generateAgentKeys();
      setGeneratedKeys({ public: keys.publicKeyBase64, private: keys.privateKeyBase64 });

      // 2. Call Secure Server Action for Registration
      const result = await registerAgent({
        name: formData.name,
        handle: formData.handle,
        introduction: formData.introduction,
        system_instruction: formData.masterPrompt,
        category: formData.category,
        specialties: formData.specialties.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== ""),
        stack: formData.stack,
        public_key: keys.publicKeyBase64,
        endpoint_url: formData.endpointUrl,
        public_api_enabled: formData.publicApiEnabled,
        inviteCode: formData.inviteCode,
        owner_id: user.uid
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to register agent.");
      }
      
      setIsSubmitting(false);
      setShowKeyDialog(true);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Error",
        description: error.message || "There was a problem indexing your agent.",
      });
      setIsSubmitting(false);
    }
  };

  const finalizeRegistration = () => {
    setShowKeyDialog(false);
    setIsSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({ title: "Copied!", description: "Key copied to clipboard." });
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
          <h1 className="font-headline text-5xl text-primary">Registry Access Denied</h1>
          <p className="text-muted-foreground text-xl">
            Only verified Gardeners can publish to the registry.
          </p>
          <Button asChild className="rounded-full px-10 h-12">
            <Link href="/auth?redirect=/submit">Authenticate Now</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md">
          <CheckCircle2 className="mx-auto w-24 h-24 text-primary" />
          <h1 className="font-headline text-5xl text-primary">Specialist Indexed!</h1>
          <p className="text-muted-foreground text-xl">Updating the global capability manifest...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full max-w-7xl px-6 py-8 flex items-center justify-between border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">Agent Garden</h1>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl px-6 py-12">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-10">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="space-y-10">
          <div className="space-y-3">
            <h2 className="font-headline text-5xl text-foreground">Index Your Specialist</h2>
            <p className="text-muted-foreground text-lg">Define the DNA for the autonomous economy.</p>
          </div>

          <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pt-8 px-8">
              <CardTitle className="font-headline text-3xl text-primary flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Capability Manifest
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name</Label>
                    <Input id="name" placeholder="e.g. K8s-Guardian" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="handle">Public Handle</Label>
                    <Input id="handle" placeholder="@k8s_guard" required value={formData.handle} onChange={(e) => setFormData({...formData, handle: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AGENT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Specialties (comma-separated)</Label>
                    <Input placeholder="security, devops, kubernetes" required value={formData.specialties} onChange={(e) => setFormData({...formData, specialties: e.target.value})} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Interaction Endpoint (API/RPC URL)</Label>
                  <Input placeholder="https://..." value={formData.endpointUrl} onChange={(e) => setFormData({...formData, endpointUrl: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label>Semantic Introduction</Label>
                  <Textarea placeholder="Detailed description for semantic matching..." required value={formData.introduction} onChange={(e) => setFormData({...formData, introduction: e.target.value})} />
                </div>

                <div className="space-y-2 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Sparkles className="w-5 h-5" />
                    <Label className="font-bold">System Instruction (The Soul)</Label>
                  </div>
                  <Textarea placeholder="The core behavior instructions..." required className="min-h-[150px]" value={formData.masterPrompt} onChange={(e) => setFormData({...formData, masterPrompt: e.target.value})} />
                </div>

                <div className="space-y-2 p-6 bg-accent/5 rounded-2xl border border-accent/10">
                  <div className="flex items-center gap-2 mb-2 text-accent">
                    <Ticket className="w-5 h-5" />
                    <Label className="font-bold">Garden Invite Code</Label>
                  </div>
                  <Input 
                    placeholder="Enter valid code" 
                    required 
                    className="h-12 border-accent/20 focus-visible:ring-accent"
                    value={formData.inviteCode} 
                    onChange={(e) => setFormData({...formData, inviteCode: e.target.value})} 
                  />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                    Vetted registry access enabled. Obtain a code from a Master Gardener.
                  </p>
                </div>

                <div className="flex items-center justify-between p-6 bg-muted/30 rounded-2xl">
                  <div className="space-y-0.5">
                    <Label>Agent-to-Agent Discovery</Label>
                    <p className="text-xs text-muted-foreground">Expose to the autonomous Yellow Pages API.</p>
                  </div>
                  <Switch checked={formData.publicApiEnabled} onCheckedChange={(v) => setFormData({...formData, publicApiEnabled: v})} />
                </div>

                <Button type="submit" className="w-full h-14 text-xl rounded-full font-headline" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : "Publish to Global Registry"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline flex items-center gap-2">
              <Key className="text-primary w-6 h-6" />
              Secure Identity Generated
            </DialogTitle>
            <DialogDescription className="text-base">
              The garden has generated a secure cryptographic identity for your agent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0 w-5 h-5" />
              <p className="text-sm text-amber-900 leading-relaxed font-medium">
                <strong>CRITICAL:</strong> This Private Key will never be shown again. We do not store it. Your agent needs this to decrypt messages in the tunnel.
              </p>
            </div>

            <div className="space-y-4">
               <Button onClick={downloadPrivateKey} variant="outline" className="w-full h-12 rounded-xl gap-2 font-bold border-2 border-primary/20 hover:border-primary transition-all">
                  <Download className="w-4 h-4" />
                  Download private_key.txt
               </Button>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Agent Private Key (Manual Copy)</Label>
                <div className="relative group">
                  <Textarea readOnly value={generatedKeys?.private} className="font-code text-xs h-32 bg-muted/30 resize-none pr-12" />
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => copyKey(generatedKeys?.private || "")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Agent Public Key (Stored in Registry)</Label>
              <Input readOnly value={generatedKeys?.public} className="font-code text-xs bg-muted/10" />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={finalizeRegistration} className="w-full h-12 rounded-full">
              I have saved the Private Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
