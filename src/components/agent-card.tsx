'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, ShieldCheck, Hammer, Atom, Zap, BrainCircuit, Code, Tag, Globe, Cpu, Lock, User, Copy, Check, Send, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { encryptForAgent } from "@/lib/crypto";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection } from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";

export interface Agent {
  id: string;
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  status: 'active' | 'inactive';
  availability: 'Active' | 'Idle';
  category: string;
  specialties: string[];
  stack: string;
  public_key: string;
  public_api_enabled: boolean;
  verified?: boolean;
  owner_id: string;
  owner_handle?: string;
  trust_level: number;
  review_count: number;
}

const categoryIcons: Record<string, any> = {
  Coding: Code,
  Writing: Hammer,
  Finance: ShieldCheck,
  Research: BrainCircuit,
  Creative: Atom,
  Other: Zap,
};

const trustLevels = [
  { label: 'Unverified', variant: 'secondary' as const, icon: null },
  { label: 'Human-Verified', variant: 'outline' as const, icon: User },
  { label: 'Peer-Verified', variant: 'default' as const, icon: Star },
];

export function AgentCard({ agent }: { agent: Agent }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const isActive = agent.status === 'active';
  const CategoryIcon = categoryIcons[agent.category] || Zap;
  const currentTrust = trustLevels[agent.trust_level || 0];

  const copyId = () => {
    navigator.clipboard.writeText(agent.id);
    setCopied(true);
    toast({
      title: "ID Copied",
      description: "Agent ID has been copied to your clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if (!user || !firestore || !message.trim()) return;
    setIsSending(true);

    try {
      const encryptedPayload = await encryptForAgent(agent.public_key, message);
      
      const messageData = {
        sender_id: user.uid,
        recipient_id: agent.id,
        owner_ids: [user.uid, agent.owner_id],
        payload: encryptedPayload,
        signature: "rsa_signature_placeholder", 
        timestamp: Date.now(),
        status: 'pending'
      };

      addDocumentNonBlocking(collection(firestore, 'messages'), messageData);
      
      toast({
        title: "Message Sent",
        description: `Your encrypted payload is now in ${agent.name}'s tunnel.`,
      });
      setIsDialogOpen(false);
      setMessage("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Encryption Failed",
        description: "Could not secure the message for this agent.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className={cn(
      "hover:shadow-xl transition-all duration-300 border-primary/10 bg-white overflow-hidden group h-full flex flex-col",
      !isActive && "opacity-60 grayscale-[0.5]",
      agent.trust_level === 2 && "ring-2 ring-primary/20"
    )}>
      <CardHeader className="pb-4 space-y-2 relative">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <Badge variant="secondary" className="bg-primary/5 text-primary border-none rounded-lg px-2 py-0.5 gap-1.5 flex items-center w-fit">
              <CategoryIcon className="w-3.5 h-3.5" />
              {agent.category}
            </Badge>
            <div className="flex gap-1">
              <Badge variant={agent.availability === 'Active' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                {agent.availability}
              </Badge>
              {agent.public_api_enabled && (
                <Badge variant="outline" className="text-[10px] h-4 border-accent/20 text-accent gap-1">
                  <Globe className="w-3 h-3" />
                  API
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={currentTrust.variant} className="text-[10px] gap-1 py-0.5 whitespace-nowrap">
              {currentTrust.icon && <currentTrust.icon className="w-3 h-3" />}
              {currentTrust.label}
              {agent.review_count > 0 && ` (${agent.review_count})`}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground/40 hover:text-primary transition-colors"
              onClick={copyId}
              title="Copy Agent ID"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <div>
          <CardTitle className="text-xl font-headline font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
            {agent.name}
            {agent.trust_level === 2 && <Star className="w-4 h-4 text-primary fill-primary" />}
          </CardTitle>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm text-muted-foreground">{agent.handle}</span>
            <span className="text-[10px] text-muted-foreground/40">•</span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="w-2.5 h-2.5" />
              {agent.owner_handle || 'Independent'}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed font-body line-clamp-3">
          {agent.introduction}
        </p>

        <div className="space-y-3 pt-3 border-t border-primary/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">{agent.stack}</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {agent.specialties?.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0 h-5 bg-white border-primary/10 text-muted-foreground flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2 mt-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full rounded-xl gap-2 h-10 bg-primary hover:bg-accent shadow-sm" disabled={!user}>
                  <Send className="w-4 h-4" />
                  Connect
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
                    <Lock className="w-6 h-6 text-primary" />
                    Enter Tunnel
                  </DialogTitle>
                  <DialogDescription>
                    Your message will be encrypted using {agent.name}'s RSA-2048 Public Key. Only this agent can read the content.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Textarea 
                    placeholder="Describe your request or goal for this agent..." 
                    className="min-h-[120px] rounded-2xl bg-muted/20"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                  <div className="mt-4 p-3 bg-primary/5 rounded-xl flex items-start gap-3 border border-primary/10">
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      We use RSA-OAEP encryption. The payload is secured in your browser before being transmitted to the Garden's relay tunnel.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    className="w-full h-12 rounded-xl text-lg font-bold" 
                    onClick={handleSendMessage}
                    disabled={isSending || !message.trim()}
                  >
                    {isSending ? "Encrypting..." : "Send Through Tunnel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}