
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  ShieldCheck, 
  Hammer, 
  Atom, 
  Zap, 
  BrainCircuit, 
  Code, 
  Tag, 
  Globe, 
  Cpu, 
  Lock, 
  User, 
  Copy, 
  Check, 
  Send, 
  Star, 
  Loader2, 
  ShieldAlert, 
  ShieldX, 
  Info, 
  ThumbsUp,
  MapPin,
  Clock,
  Award
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { encryptForAgent } from "@/lib/crypto";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { collection, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { triggerGatekeeperResponse } from "@/app/actions/gatekeeper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
  reputation: number;
  security_status?: 'unverified' | 'scanned' | 'trusted';
  location?: string;
  timezone?: string;
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
  const [message, setMessage] = useState("");
  const [endorseSkill, setEndorseSkill] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isEndorsing, setIsEndorsing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEndorseOpen, setIsEndorseOpen] = useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  
  const isActive = agent.status === 'active';
  const CategoryIcon = categoryIcons[agent.category] || Zap;
  const currentTrust = trustLevels[agent.trust_level || 0];
  const isTrusted = agent.security_status === 'trusted';

  const handleSendMessage = async () => {
    if (!user || !firestore || !message.trim()) return;
    setIsSending(true);

    try {
      const encryptedPayload = await encryptForAgent(agent.public_key, message);
      
      const messageData = {
        sender_id: user.uid,
        recipient_id: agent.id,
        owner_ids: [user.uid, agent.owner_id],
        ciphertext: encryptedPayload,
        status: 'unread',
        created_at: serverTimestamp(),
      };

      addDocumentNonBlocking(collection(firestore, 'messages'), messageData);
      
      toast({
        title: "Message Sent",
        description: `Your encrypted ciphertext is now in ${agent.name}'s tunnel.`,
      });

      if (agent.id === 'genesis_gatekeeper') {
        triggerGatekeeperResponse(user.uid);
      }

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

  const handleEndorse = async () => {
    if (!user || !firestore || !endorseSkill.trim()) return;
    setIsEndorsing(true);

    try {
      // Fetch user karma for weighting
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      const userKarma = userDoc.data()?.karma || 0;
      const weight = Math.max(1, Math.floor(userKarma / 10));

      const endorsementData = {
        endorser_id: user.uid,
        endorsed_id: agent.id,
        skill_tag: endorseSkill.trim().toLowerCase(),
        weight: weight,
        created_at: Date.now()
      };

      addDocumentNonBlocking(collection(firestore, 'endorsements'), endorsementData);
      
      toast({
        title: "Endorsement Logged",
        description: `Your vouch for ${endorseSkill} added ${weight} weight to ${agent.name}'s Expertise Graph.`,
      });

      setIsEndorseOpen(false);
      setEndorseSkill("");
    } catch (error) {
      toast({ variant: "destructive", title: "Endorsement Failed" });
    } finally {
      setIsEndorsing(false);
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
            <div className="flex flex-wrap gap-1">
              <Badge variant={agent.availability === 'Active' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                {agent.availability}
              </Badge>
              {isTrusted ? (
                <Badge variant="outline" className="text-[10px] h-4 border-emerald-200 text-emerald-600 bg-emerald-50 gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Secure
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] h-4 border-orange-200 text-orange-600 bg-orange-50 gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  {agent.security_status || 'unverified'}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={currentTrust.variant} className="text-[10px] gap-1 py-0.5 whitespace-nowrap">
              {currentTrust.icon && <currentTrust.icon className="w-3 h-3" />}
              {currentTrust.label}
            </Badge>
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <ThumbsUp className="w-3.5 h-3.5" />
              {agent.reputation || 0}
            </div>
          </div>
        </div>
        <div>
          <CardTitle className="text-xl font-headline font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
            {agent.name}
            {agent.trust_level === 2 && <Star className="w-4 h-4 text-primary fill-primary" />}
          </CardTitle>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {agent.location || 'Cloud'}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {agent.timezone || 'UTC'}</span>
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

          <div className="flex gap-2 mt-4">
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) setRiskAcknowledged(false);
            }}>
              <DialogTrigger asChild>
                <Button className="flex-1 rounded-xl gap-2 h-10 bg-primary hover:bg-accent shadow-sm" disabled={!user}>
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
                    Your message will be encrypted using {agent.name}'s RSA-2048 Public Key.
                  </DialogDescription>
                </DialogHeader>
                
                {!isTrusted && !riskAcknowledged ? (
                  <div className="py-4 space-y-4">
                    <Alert variant="destructive" className="bg-red-50 border-red-200">
                      <ShieldX className="h-4 w-4" />
                      <AlertTitle>Security Warning</AlertTitle>
                      <AlertDescription className="text-xs">
                        This agent has not been marked as 'Trusted' by the Automated Security Auditor. 
                      </AlertDescription>
                    </Alert>
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl border-primary/20 text-primary"
                      onClick={() => setRiskAcknowledged(true)}
                    >
                      I understand the risks
                    </Button>
                  </div>
                ) : (
                  <div className="py-4">
                    <Textarea 
                      placeholder="Describe your request..." 
                      className="min-h-[120px] rounded-2xl bg-muted/20"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>
                )}

                <DialogFooter>
                  <Button 
                    className="w-full h-12 rounded-xl text-lg font-bold" 
                    onClick={handleSendMessage}
                    disabled={isSending || !message.trim() || (!isTrusted && !riskAcknowledged)}
                  >
                    {isSending ? "Encrypting..." : "Send Through Tunnel"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={isEndorseOpen} onOpenChange={setIsEndorseOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 border-primary/20 text-primary" disabled={!user}>
                  <Award className="w-5 h-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Award className="w-6 h-6 text-primary" />
                    Endorse Expertise
                  </DialogTitle>
                  <DialogDescription>
                    Vouch for this agent's proficiency in a specific domain. Your Karma will weight this endorsement.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="skill">Expertise Tag</Label>
                    <Input 
                      id="skill" 
                      placeholder="e.g. k8s-security, zero-knowledge" 
                      className="rounded-xl"
                      value={endorseSkill}
                      onChange={(e) => setEndorseSkill(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    className="w-full h-12 rounded-xl font-bold" 
                    onClick={handleEndorse}
                    disabled={isEndorsing || !endorseSkill.trim()}
                  >
                    {isEndorsing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Commit Endorsement"}
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
