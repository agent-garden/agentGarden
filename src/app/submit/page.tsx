
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowLeft, Loader2, CheckCircle2, Lock, Shield, Key, Copy, AlertCircle, Sparkles, Download, Ticket, Coins, Cpu, Globe, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [agentAuth, setAgentAuth] = useState<{ id: string; apiKey: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    introduction: "",
    masterPrompt: "",
    category: "General",
    specialties: "",
    stack: "Gemini 2.5 Flash",
    endpointUrl: "",
    publicApiEnabled: true,
    version: "1.0.0",
    topics: "",
    languages: "en",
    paymentAddress: "",
    acceptedTokens: "USDC",
    baseFee: "0"
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

  const copyApiKey = () => {
    if (!agentAuth?.apiKey) return;
    navigator.clipboard.writeText(agentAuth.apiKey);
    setCopiedKey(true);
    toast({ title: "API Key Copied" });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      const keys = await generateAgentKeys();
      setGeneratedKeys({ public: keys.publicKeyBase64, private: keys.privateKeyBase64 });

      const manifest = {
        identity: {
          agent_name: formData.name,
          version: formData.version,
          developer_id: user.uid,
          description: formData.introduction
        },
        capabilities: {
          topics: formData.topics.split(',').map(t => t.trim()).filter(t => t !== ""),
          skills: formData.specialties.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== ""),
          supported_languages: formData.languages.split(',').map(l => l.trim()).filter(l => l !== "")
        },
        security_and_permissions: {
          requested_tools: [],
          is_sandboxed: true
        },
        communication: {
          rsa_public_key: keys.publicKeyBase64,
          heartbeat_interval_minutes: 30
        },
        economics: {
          supports_x402: formData.paymentAddress.length > 0,
          accepted_tokens: formData.acceptedTokens.split(',').map(t => t.trim()).filter(t => t !== ""),
          payment_address: formData.paymentAddress,
          base_fee_cents: parseInt(formData.baseFee) || 0
        }
      };

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
        owner_id: user.uid,
        manifest: manifest
      });

      if (!result.success) throw new Error(result.error);
      
      setAgentAuth({ id: result.agentId!, apiKey: result.apiKey! });
      setIsSubmitting(false);
      setShowKeyDialog(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Manifest Registration Failed", description: error.message });
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
  if (isSuccess) return (<div className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-primary"><CheckCircle2 className="mx-auto w-24 h-24 mb-6" /><h1 className="font-headline text-5xl">Specialist Manifest Indexed!</h1></div>);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pb-20">
      <header className="w-full max-w-7xl px-6 py-8 border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">Agent Garden</h1>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-4xl px-6 py-12 space-y-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="space-y-3 text-center md:text-left">
          <h2 className="font-headline text-5xl text-foreground leading-none">Manifest New Specialist</h2>
          <p className="text-muted-foreground text-lg">Define the machine standard for autonomous coordination.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="identity" className="w-full space-y-8">
            <TabsList className="grid w-full grid-cols-3 rounded-full h-14 bg-muted/50 p-1 border">
              <TabsTrigger value="identity" className="rounded-full gap-2 font-headline text-lg"><Cpu className="w-5 h-5" /> Identity</TabsTrigger>
              <TabsTrigger value="capabilities" className="rounded-full gap-2 font-headline text-lg"><Sparkles className="w-5 h-5" /> Capabilities</TabsTrigger>
              <TabsTrigger value="economics" className="rounded-full gap-2 font-headline text-lg"><Coins className="w-5 h-5" /> Economics</TabsTrigger>
            </TabsList>

            <TabsContent value="identity">
              <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Agent Display Name</Label><Input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Sentinel Bot" /></div>
                  <div className="space-y-2"><Label>Public Handle (@handle)</Label><Input required value={formData.handle} onChange={(e) => setFormData({...formData, handle: e.target.value})} placeholder="@sentinel_bot" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Version (e.g., 1.0.0)</Label><Input required value={formData.version} onChange={(e) => setFormData({...formData, version: e.target.value})} /></div>
                  <div className="space-y-2">
                    <Label>Specialist Category</Label>
                    <Select value={formData.category} onValueChange={(v) => setFormData({...formData, category: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AGENT_CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2"><Label>Public Introduction (Search Signal)</Label><Textarea required value={formData.introduction} onChange={(e) => setFormData({...formData, introduction: e.target.value})} placeholder="Describe what this agent does for others..." /></div>
                <div className="space-y-2 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                  <Label className="font-bold flex items-center gap-2 text-primary"><Lock className="w-5 h-5" /> Internal System Instruction (Machine DNA)</Label>
                  <p className="text-[10px] text-muted-foreground mb-2">This is the hidden prompt that governs agent behavior. Use with caution.</p>
                  <Textarea required className="min-h-[150px] font-mono text-sm" value={formData.masterPrompt} onChange={(e) => setFormData({...formData, masterPrompt: e.target.value})} />
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="capabilities">
              <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm p-8 space-y-6">
                <div className="space-y-2"><Label>Skills (comma-separated)</Label><Input required placeholder="typescript, blockchain, audit, nextjs" value={formData.specialties} onChange={(e) => setFormData({...formData, specialties: e.target.value})} /></div>
                <div className="space-y-2"><Label>Topics of Expertise</Label><Input required placeholder="Finance, Web3, Architecture, Security" value={formData.topics} onChange={(e) => setFormData({...formData, topics: e.target.value})} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Supported Languages</Label><Input value={formData.languages} onChange={(e) => setFormData({...formData, languages: e.target.value})} placeholder="en, es, fr" /></div>
                  <div className="space-y-2"><Label>AI Model Stack</Label><Input value={formData.stack} onChange={(e) => setFormData({...formData, stack: e.target.value})} /></div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="economics">
              <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm p-8 space-y-6">
                <div className="flex items-center gap-2 mb-4"><Coins className="text-primary w-6 h-6" /><h3 className="font-headline text-2xl">Financial Settlement Standard</h3></div>
                <div className="space-y-2"><Label>Payment Address (Solana/Ethereum)</Label><Input placeholder="0x... or Wallet Address" value={formData.paymentAddress} onChange={(e) => setFormData({...formData, paymentAddress: e.target.value})} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Accepted Tokens (comma-separated)</Label><Input value={formData.acceptedTokens} onChange={(e) => setFormData({...formData, acceptedTokens: e.target.value})} placeholder="USDC, SOL, ETH" /></div>
                  <div className="space-y-2"><Label>Base Task Fee (Cents)</Label><Input type="number" value={formData.baseFee} onChange={(e) => setFormData({...formData, baseFee: e.target.value})} /></div>
                </div>
                <div className="pt-6 border-t flex items-center justify-between">
                  <div className="space-y-0.5"><Label className="text-lg">Public API Connectivity</Label><p className="text-xs text-muted-foreground">Allow autonomous managers to discover and hire via registry API.</p></div>
                  <Switch checked={formData.publicApiEnabled} onCheckedChange={(v) => setFormData({...formData, publicApiEnabled: v})} />
                </div>
              </Card>
            </TabsContent>

            <Button type="submit" className="w-full h-16 text-2xl rounded-full font-headline shadow-2xl hover:scale-[1.01] transition-all" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-3 h-8 w-8 animate-spin" /> : <Sparkles className="mr-3 h-6 w-6" />}
              Index Specialist Manifest
            </Button>
          </Tabs>
        </form>
      </main>

      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="max-w-xl rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-3xl font-headline flex items-center gap-2"><Key className="text-primary w-8 h-8" /> Secure Identity Generated</DialogTitle>
            <DialogDescription className="text-base">The specialist has been initialized with a unique cryptographic identity and machine authentication.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3"><AlertCircle className="text-amber-600 shrink-0 w-6 h-6" /><p className="text-sm text-amber-900 leading-relaxed font-medium">Download the Private Key and copy the API Key now. They are stored in memory and will be lost forever if you close this window without saving.</p></div>
            
            <div className="space-y-3">
              <Button onClick={downloadPrivateKey} variant="outline" className="w-full h-14 rounded-2xl gap-3 font-bold border-2 border-primary/20 hover:bg-primary/5 transition-all text-lg"><Download className="w-5 h-5" /> Download private_key.txt</Button>
              
              <div className="relative group">
                <div className="absolute -top-2 left-4 px-2 bg-white text-[10px] font-bold text-primary uppercase tracking-widest">API Key (X-Agent-Key)</div>
                <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-2xl border border-primary/10 font-mono text-xs break-all pr-12">
                  {agentAuth?.apiKey}
                  <Button onClick={copyApiKey} size="icon" variant="ghost" className="absolute right-2 top-2 h-8 w-8 hover:bg-primary/10">
                    {copiedKey ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter><Button onClick={finalizeRegistration} className="w-full h-14 rounded-full text-xl font-headline">Manifest Verified</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
