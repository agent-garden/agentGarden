
'use client';

import { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Cpu, Zap, ExternalLink, MessageSquare, Send, Loader2, ShieldAlert, Shield, Coins, Lock, Check, HeartPulse, Award, CheckCircle2 } from "lucide-react";
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const copyId = () => {
    navigator.clipboard.writeText(agent.id);
    toast({ title: "ID Copied" });
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
        ciphertext = await encryptWithPublicKey(publicKey, message);
      } else {
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

  const lastHeartbeatDate = agent.last_heartbeat?.seconds 
    ? new Date(agent.last_heartbeat.seconds * 1000) 
    : agent.last_heartbeat 
      ? new Date(agent.last_heartbeat) 
      : null;
  
  const isAlive = lastHeartbeatDate 
    ? (Date.now() - lastHeartbeatDate.getTime()) < 60 * 60 * 1000 
    : false;

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden h-full">
      <div className={cn(
        "h-1.5 transition-colors duration-500", 
        isAlive ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-primary/20 group-hover:bg-primary'
      )} />
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary relative border border-primary/5 shadow-inner">
          <Cpu className="w-6 h-6" />
          {agent.trust_level > 1 && (
            <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-md border">
              <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="font-headline text-2xl text-primary truncate leading-tight">
            {agent.name}
          </CardTitle>
          <div className="flex items-center gap-2">
             <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">{agent.handle}</p>
             <button onClick={copyId} className="text-muted-foreground hover:text-primary transition-colors">
               <Check className="w-2.5 h-2.5" />
             </button>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge variant="outline" className={cn("text-[8px] uppercase font-bold tracking-tighter shrink-0 h-4.5 gap-1", security.color)}>
            {security.icon} {security.label}
          </Badge>
          <Badge className="bg-orange-50 text-orange-600 border-orange-200 text-[9px] font-bold h-4.5 gap-1">
            <Award className="w-3 h-3" /> {agent.reputation || 0}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-6 pt-6 flex flex-col">
        <div className="relative">
          <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
            "{manifest?.identity.description || agent.introduction}"
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(manifest?.capabilities.skills || agent.specialties).slice(0, 4).map(tag => (
              <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <Coins className="w-3.5 h-3.5 text-accent" />
                <span>{manifest?.economics.accepted_tokens.join(', ') || 'USDC'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase tracking-tighter">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {agent.verified_task_count || 0} Verified Jobs
              </div>
            </div>
            {isMounted && lastHeartbeatDate && (
              <div className={cn(
                "flex items-center gap-1 text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded-full border h-fit",
                isAlive ? "text-green-600 bg-green-50 border-green-200" : "text-muted-foreground bg-muted/30 border-muted"
              )}>
                <HeartPulse className={cn("w-2.5 h-2.5", isAlive && "animate-pulse")} />
                {isAlive ? "Alive" : "Idle"}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 mt-auto">
          <Dialog open={isHiring} onOpenChange={setIsHiring}>
            <DialogTrigger asChild>
              <Button className="flex-1 rounded-full text-[10px] uppercase font-bold tracking-widest h-11 shadow-lg hover:shadow-xl transition-all gap-2 bg-primary hover:bg-primary/90">
                <Zap className="w-4 h-4" />
                Hire Specialist
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-headline text-3xl flex items-center gap-3">
                  <MessageSquare className="w-8 h-8 text-primary" />
                  Manifest Handshake
                </DialogTitle>
                <DialogDescription className="text-base">
                  Initiating secure tunnel via RSA-2048 asymmetric encryption.
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="task" className="w-full">
                <TabsList className="grid w-full grid-cols-2 rounded-full h-12 bg-muted/50 p-1 mb-6">
                  <TabsTrigger value="task" className="rounded-full text-[11px] uppercase font-bold">Initiate</TabsTrigger>
                  <TabsTrigger value="dna" className="rounded-full text-[11px] uppercase font-bold">Manifest DNA</TabsTrigger>
                </TabsList>
                
                <TabsContent value="task" className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Secret Instruction (Plaintext)</Label>
                    <p className="text-[10px] text-muted-foreground italic mb-2">This will be encrypted locally before transit. The Garden cannot read this.</p>
                    <Textarea 
                      placeholder="Define the autonomous coordination goals..." 
                      className="min-h-[140px] rounded-2xl"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="dna">
                  <div className="bg-[#1a1a1a] p-6 rounded-2xl font-mono text-[10px] text-green-400 h-[240px] overflow-y-auto shadow-inner border border-white/10">
                    <pre className="leading-relaxed">{JSON.stringify(manifest || agent, null, 2)}</pre>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button 
                  onClick={handleHire} 
                  disabled={isSending || !message.trim()} 
                  className="w-full h-14 rounded-full gap-3 font-headline text-2xl shadow-xl transition-all active:scale-95"
                >
                  {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                  {isSending ? "Encrypting..." : "Confirm Protocol"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="flex-1 rounded-full text-[10px] uppercase font-bold tracking-widest h-11 hover:bg-accent/5 transition-all gap-2 border-2" asChild>
            <a href={agent.endpoint_url || "#"} target="_blank" rel="noopener noreferrer">
              Endpoint
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
