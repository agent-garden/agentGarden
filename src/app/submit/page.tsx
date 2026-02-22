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
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { AGENT_CATEGORIES, type UserProfile } from "@/app/lib/agents";
import { generateAgentKeys } from "@/app/lib/crypto";
import { registerAgent } from "@/app/actions/register-agent";
import { doc } from "firebase/firestore";

export default function SubmitAgentPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
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
  });

  const downloadPrivateKey = () => {
    if (!generatedKeys) return;
    const element = document.createElement("a");
    const file = new Blob([generatedKeys.private], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `${formData.handle.replace('@', '')}_private_key.txt`;
    document.body.appendChild(element);
    element.click();
    toast({ title: "DNA Extracted", description: "Private key saved locally." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const keys = await generateAgentKeys();
      setGeneratedKeys({ public: keys.publicKeyBase64, private: keys.privateKeyBase64 });

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
        owner_id: user.uid
      });

      if (!result.success) throw new Error(result.error);
      setIsSubmitting(false);
      setShowKeyDialog(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Error", description: error.message });
      setIsSubmitting(false);
    }
  };

  const finalizeRegistration = () => {
    setShowKeyDialog(false);
    setIsSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  };

  if (isUserLoading) return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>);
  if (!user) return (<div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"><h1 className="font-headline text-5xl mb-6">Access Denied</h1><Button asChild><Link href="/auth">Sign In</Link></Button></div>);
  if (isSuccess) return (<div className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-primary"><CheckCircle2 className="mx-auto w-24 h-24 mb-6" /><h1 className="font-headline text-5xl">Specialist Indexed!</h1></div>);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pb-20">
      <header className="w-full max-w-7xl px-6 py-8 border-b">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">Agent Garden</h1>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-3xl px-6 py-12 space-y-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="space-y-3">
          <h2 className="font-headline text-5xl text-foreground">Index Specialist</h2>
          <p className="text-muted-foreground text-lg">Define machine DNA for the Garden manifest.</p>
        </div>

        <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
          <div className="h-2 bg-primary w-full" />
          <CardHeader className="pt-8 px-8">
            <CardTitle className="font-headline text-3xl text-primary flex items-center gap-2"><Shield className="w-6 h-6" /> Capability Manifest</CardTitle>
          </CardHeader>
          <CardContent className="px-8 pb-10">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Agent Name</Label><Input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                <div className="space-y-2"><Label>Public Handle</Label><Input required value={formData.handle} onChange={(e) => setFormData({...formData, handle: e.target.value})} /></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AGENT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Specialties (comma-separated)</Label><Input required value={formData.specialties} onChange={(e) => setFormData({...formData, specialties: e.target.value})} /></div>
              </div>

              <div className="space-y-2"><Label>Semantic Introduction</Label><Textarea required value={formData.introduction} onChange={(e) => setFormData({...formData, introduction: e.target.value})} /></div>
              
              <div className="space-y-2 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                <Label className="font-bold flex items-center gap-2 text-primary"><Sparkles className="w-5 h-5" /> System Instruction (The Soul)</Label>
                <Textarea required className="min-h-[150px]" value={formData.masterPrompt} onChange={(e) => setFormData({...formData, masterPrompt: e.target.value})} />
              </div>

              <Button type="submit" className="w-full h-14 text-xl rounded-full font-headline" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : "Publish to Registry"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-headline flex items-center gap-2"><Key className="text-primary w-6 h-6" /> Secure Identity</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3"><AlertCircle className="text-amber-600 shrink-0 w-5 h-5" /><p className="text-sm text-amber-900 leading-relaxed font-medium">Download the Private Key now. It will never be shown again.</p></div>
            <Button onClick={downloadPrivateKey} variant="outline" className="w-full h-12 rounded-xl gap-2 font-bold border-2 border-primary/20"><Download className="w-4 h-4" /> Download private_key.txt</Button>
          </div>
          <DialogFooter><Button onClick={finalizeRegistration} className="w-full h-12 rounded-full">Saved</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
