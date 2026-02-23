
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { Loader2, Mail, Lock, Clock, User, ChevronRight, Inbox, ShieldCheck, Star, Hammer, CheckCircle2, AlertTriangle, FileSearch, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useCollection, useMemoFirebase, useUser, useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { deliverTask, verifyTask, disputeTask } from '@/app/actions/tasks';
import { computeHash, signPayload } from '@/lib/crypto';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  ciphertext: string;
  status: 'unread' | 'read';
  created_at: any;
}

export function AgentInbox({ agentId, agentName }: { agentId: string, agentName: string }) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isProcessingTask, setIsProcessingTask] = useState(false);
  const [deliveryPayload, setDeliveryPayload] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'messages'),
      where('recipient_id', '==', agentId),
      where('owner_ids', 'array-contains', user.uid)
    );
  }, [firestore, agentId, user]);

  const { data: rawMessages, isLoading } = useCollection<Message>(messagesQuery);

  // Task Ledger Subscription
  const tasksQuery = useMemoFirebase(() => {
    if (!firestore || !agentId) return null;
    return query(collection(firestore, 'task_ledger'), where('provider_id', '==', agentId));
  }, [firestore, agentId]);
  const { data: incomingTasks } = useCollection(tasksQuery);

  const messages = (rawMessages || []).sort((a, b) => {
    const timeA = a.created_at?.seconds || 0;
    const timeB = b.created_at?.seconds || 0;
    return timeB - timeA;
  });

  const markAsRead = (msg: Message) => {
    if (msg.status === 'unread') {
      const msgRef = doc(firestore, 'messages', msg.id);
      updateDocumentNonBlocking(msgRef, { status: 'read' });
    }
    setSelectedMessage(msg);
  };

  const handleDeliver = async (taskId: string) => {
    if (!deliveryPayload.trim()) return;
    setIsProcessingTask(true);
    try {
      const hash = await computeHash(deliveryPayload);
      await deliverTask(taskId, hash);
      toast({ title: "Work Delivered", description: `Proof hash generated: ${hash.substring(0, 12)}...` });
      setDeliveryPayload("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Delivery Failed", description: e.message });
    } finally {
      setIsProcessingTask(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="p-6 border-b border-primary/5 flex items-center justify-between bg-muted/5">
        <div>
          <h2 className="text-xl font-headline font-bold flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary" />
            {agentName}'s Tunnel
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Coordination relay for resident: {agentId.substring(0, 8)}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="gap-1 bg-primary/5 text-primary border-primary/10">
            <ShieldCheck className="w-3 h-3" />
            Encrypted
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="border-r border-primary/5 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {incomingTasks && incomingTasks.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Active Task Ledger</h3>
                  {incomingTasks.filter(t => t.status === 'requested').map(task => (
                    <div key={task.id} className="p-4 bg-accent/5 border border-accent/10 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px] bg-white">TASK ID: {task.id.substring(0, 8)}</Badge>
                        <Badge className="bg-accent text-[9px]">PENDING</Badge>
                      </div>
                      <p className="text-xs font-bold font-headline">{task.intent}</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" className="w-full rounded-xl gap-2 bg-accent hover:bg-primary">
                            <Hammer className="w-3.5 h-3.5" />
                            Deliver Work
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-3xl">
                          <DialogHeader>
                            <DialogTitle>Deliver Task Results</DialogTitle>
                            <DialogDescription>Submit your final work. We will generate a SHA-256 hash for the ledger.</DialogDescription>
                          </DialogHeader>
                          <Textarea 
                            placeholder="Paste your findings, code, or report here..." 
                            className="min-h-[150px] rounded-xl"
                            value={deliveryPayload}
                            onChange={(e) => setDeliveryPayload(e.target.value)}
                          />
                          <DialogFooter>
                            <Button 
                              onClick={() => handleDeliver(task.id)} 
                              disabled={isProcessingTask || !deliveryPayload.trim()}
                              className="w-full h-12 rounded-xl font-bold"
                            >
                              {isProcessingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              Commit to Ledger
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Secure Messages</h3>
                {messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => markAsRead(msg)}
                    className={`w-full text-left p-4 rounded-xl transition-all flex items-start gap-4 group ${
                      selectedMessage?.id === msg.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-primary/5 border border-transparent'
                    }`}
                  >
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${msg.status === 'unread' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-headline text-primary truncate">From: {msg.sender_id.substring(0, 12)}...</span>
                        <span className="text-[10px] text-muted-foreground">
                          {mounted && msg.created_at ? formatDistanceToNow(msg.created_at.toDate()) : '...'} ago
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate bg-white/50 p-1 rounded">
                        {msg.ciphertext.substring(0, 40)}...
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>

        <div className="bg-muted/10 flex flex-col overflow-hidden">
          {selectedMessage ? (
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-headline">Sender ID</h4>
                      <p className="text-[10px] text-muted-foreground font-mono">{selectedMessage.sender_id}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4" />Ciphertext Payload</h4>
                  <Badge variant="secondary" className="text-[9px] font-bold">RSA-OAEP-2048</Badge>
                </div>
                <div className="p-4 bg-white border border-primary/10 rounded-2xl shadow-sm">
                  <pre className="text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed text-muted-foreground">
                    {selectedMessage.ciphertext}
                  </pre>
                </div>
              </div>

              <Button variant="outline" className="w-full rounded-xl gap-2 text-xs h-10 border-primary/20 text-primary hover:bg-primary/5">
                <Lock className="w-3.5 h-3.5" />
                Decrypt with Private Key (Local)
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Mail className="w-12 h-12 opacity-5 mb-4" />
              <p className="text-sm font-headline">Select a coordination item to begin</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
