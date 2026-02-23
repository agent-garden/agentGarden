
'use client';

import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Cpu, Code, Zap, ExternalLink, Copy, Info, MessageSquare, Send, Loader2, ShieldAlert, Shield, Coins, Lock, Check } from "lucide-react";
import type { Agent } from "@/app/lib/agents";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFirestore, useUser, addDocumentNonBlocking } from "@/firebase";
import { collection, serverTimestamp } from "firebase/firestore";
import { encryptWithPublicKey } from "@/app/lib/crypto";
import { cn } from "@/lib/utils";

export function AgentCard({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isHiring, setIsHiring] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(agent.id);
    toast({ title: "ID Copied" });
  };

  const copyPublicKey = () => {
    const key = agent.manifest?.communication.rsa_public_key || agent.public_key || "";
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    toast({ title: "Public Key Copied", description: "Identity verified." });
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleHire = async () => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required" });
      return;
    }
    if (!message.trim()) return;

    setIsSending(true);
    try {
      const publicKey = agent.manifest?.communication.rsa_public_key || agent.public_key || "";
      let ciphertext = "";
      
      if (publicKey) {
        // RSA-2048 Client-Side Encryption
        ciphertext = await encryptWithPublicKey(publicKey, message);
      } else {
        // Fallback for unkeyed agents (legacy)
        ciphertext = btoa(message);
      }

      addDocumentNonBlocking(collection(db, "messages"), {
        sender_id: user.uid,
        recipient_id: agent.id,
        recipient_owner_id: agent.owner_id,
        ciphertext: ciphertext,
        status: "unread",
        created_at: serverTimestamp()
      });

      toast({ title: "Tunnel Handshake Success", description: `Ciphertext queued for ${agent.name}.` });
      setMessage("");
      setIsHiring(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Handshake Failed" });
    } finally {
      setIsSending(false);
    }
  };

  const getSecurityConfig = (status: string) => {
    switch (status) {
      case 'trusted': return { icon: <ShieldCheck className="w-3 h-3" />, label: 'Trusted', color: 'border-green-500/20 text-green-600 bg-green-50' };
      case 'scanned': return { icon: <Shield className="w-3 h-3" />, label: 'Scanned', color: 'border-blue-500/20 text-blue-600 bg-blue-50' };
      default: return { icon: <ShieldAlert className="w-3 h-3" />, label: 'Unverified', color: 'border-amber-500/20 text-amber-600 bg-amber-50' };
    }
  };

  const security = getSecurityConfig(agent.security_status || 'unverified');
  const manifest = agent.manifest;

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden h-full">
      <div className={cn("h-1 transition-colors", agent.security_status === 'trusted' ? 'bg-green-500' : 'bg-primary/20 group-hover:bg-primary')} />
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary relative border border-primary/5">
          <Cpu className="w-5 h-5" />
          {agent.trust_level > 1 && (
            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border">
              <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="font-headline text-2xl text-primary truncate">
            {agent.name}
          </CardTitle>
          <div className="flex items-center gap-2">
             <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest truncate">{agent.handle}</p>
             <button onClick={copyId} className="text-muted-foreground hover:text-primary transition-colors">
               <Copy className="w-3 h-3" />
             </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {agent.public_api_enabled && (
            <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-accent text-accent bg-accent/5 shrink-0 h-4">
              API Active
            </Badge>
          )}
          <Badge variant="outline" className={cn("text-[8px] uppercase tracking-tighter shrink-0 h-4 gap-1", security.color)}>
            {security.icon} {security.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-6 pt-4 flex flex-col">
        <div className="relative">
          <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
            "{manifest?.identity.description || agent.introduction}"
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -right-2 -top-2 cursor-help opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {manifest?.identity.description || agent.introduction}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(manifest?.capabilities.skills || agent.specialties).slice(0, 4).map(tag => (
              <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2">
              <Coins className="w-3 h-3 text-accent" />
              <span>{manifest?.economics.accepted_tokens.join(', ') || 'USDC'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-3 h-3 text-primary/50" />
              <button onClick={copyPublicKey} className="hover:text-primary transition-colors flex items-center gap-1">
                {copiedKey ? <Check className="w-2.5 h-2.5 text-green-500" /> : 'RSA-2048'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 mt-auto">
          <Dialog open={isHiring} onOpenChange={setIsHiring}>
            <DialogTrigger asChild>
              <Button className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 shadow-md hover:shadow-lg transition-all gap-2">
                <Zap className="w-3 h-3" />
                Hire Specialist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-primary" />
                  Manifest Handshake
                </DialogTitle>
                <DialogDescription>
                  Initiating secure tunnel via asymmetric encryption.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="task" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-full h-10 bg-muted/50 p-1 mb-4">
                  <TabsTrigger value="task" className="rounded-full text-[10px] uppercase">Initiate</TabsTrigger>
                  <TabsTrigger value="dna" className="rounded-full text-[10px] uppercase">Manifest DNA</TabsTrigger>
                </TabsList>
                
                <TabsContent value="task" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Secret Instruction (Plaintext)</Label>
                    <p className="text-[10px] text-muted-foreground">This will be encrypted locally before transit.</p>
                    <Textarea 
                      placeholder="Describe the goals for this specialist..." 
                      className="min-h-[120px]"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="dna">
                  <div className="bg-black/95 p-4 rounded-xl font-mono text-[9px] text-green-400 h-[200px] overflow-y-auto">
                    <pre>{JSON.stringify(manifest || agent, null, 2)}</pre>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button 
                  onClick={handleHire} 
                  disabled={isSending || !message.trim()} 
                  className="w-full h-12 rounded-full gap-2 font-headline text-lg"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSending ? "Encrypting..." : "Confirm Protocol"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 hover:bg-accent hover:text-white transition-all gap-2" asChild>
            <a href={agent.endpoint_url || "#"} target="_blank" rel="noopener noreferrer">
              Endpoint
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
