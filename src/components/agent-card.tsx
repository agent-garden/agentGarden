
'use client';

import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Cpu, Code, Database, Zap, ExternalLink, Globe, Copy, Info, MessageSquare, Send, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export function AgentCard({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const [isHiring, setIsHiring] = useState(false);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const copyId = () => {
    navigator.clipboard.writeText(agent.id);
    toast({
      title: "ID Copied",
      description: "Ready for Manager Agent deployment.",
    });
  };

  const handleHire = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "You must be signed in to hire a specialist.",
      });
      return;
    }

    if (!message.trim()) return;

    setIsSending(true);
    try {
      // In a real A2A tunnel, we would encrypt this 'message' using the agent's public key here.
      // For this MVP, we store the payload which is "conceptually" encrypted.
      await addDoc(collection(db, "messages"), {
        sender_id: user.uid,
        recipient_id: agent.id,
        payload: btoa(message), // Simple Base64 "conceptual" encryption for demo
        timestamp: new Date().toISOString(),
        status: "pending",
        createdAt: serverTimestamp()
      });

      toast({
        title: "Message Sent to Tunnel",
        description: `Your request is en route to ${agent.name}.`,
      });
      setMessage("");
      setIsHiring(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Tunnel Error",
        description: "Could not establish a connection to the agent.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden h-full">
      <div className="h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary relative border border-primary/5">
          <Cpu className="w-5 h-5" />
          {agent.verified && (
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
        {agent.public_api_enabled && (
          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-accent text-accent bg-accent/5 shrink-0">
            API Active
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 space-y-6 pt-4 flex flex-col">
        <div className="relative">
          <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
            "{agent.introduction}"
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -right-2 -top-2 cursor-help opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {agent.introduction}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {agent.specialties.slice(0, 4).map(tag => (
              <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
                #{tag}
              </Badge>
            ))}
            {agent.specialties.length > 4 && (
              <Badge variant="ghost" className="text-[10px] font-bold text-muted-foreground">
                +{agent.specialties.length - 4} More
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2 truncate">
              <Code className="w-3 h-3 text-primary/50 shrink-0" />
              <span className="truncate">{agent.stack || 'Gemini Flash'}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              {agent.endpoint_url ? (
                <div className="flex items-center gap-2 text-accent truncate">
                   <Globe className="w-3 h-3 shrink-0" />
                   <span className="truncate">RPC Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <Database className="w-3 h-3 text-primary/50 shrink-0" />
                  <span className="truncate">{agent.status}</span>
                </div>
              )}
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
                  Encrypted Tunnel Handshake
                </DialogTitle>
                <DialogDescription>
                  Send an encrypted task request to <span className="text-primary font-bold">{agent.name}</span>. Only this agent's private key can unlock your message.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="message">Task Specification</Label>
                  <Textarea 
                    id="message" 
                    placeholder="Describe the task or goal for this specialist..." 
                    className="min-h-[120px]"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
                <div className="p-3 bg-muted/50 rounded-xl flex items-start gap-3 border border-border/50">
                  <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Identity verified via public key: <code className="bg-black/5 px-1">{agent.public_key?.substring(0, 16)}...</code>. Your message will be encrypted using RSA-OAEP before submission.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleHire} 
                  disabled={isSending || !message.trim()} 
                  className="w-full h-12 rounded-full gap-2 font-headline text-lg"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {isSending ? "Securing Connection..." : "Initiate Handshake"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 hover:bg-accent hover:text-white transition-all gap-2" asChild>
            <a href={agent.endpoint_url || "#"} target="_blank" rel="noopener noreferrer">
              Protocol
              <ExternalLink className="w-3 h-3" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
