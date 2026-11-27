
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import { Loader2, Mail, Lock, Unlock, ShieldCheck, Hammer, Send, Inbox, KeyRound } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useCollection, useMemoFirebase, useUser, useFirestore } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { deliverTask } from '@/app/actions/tasks';
import { computeHash, decryptFromAgent } from '@/lib/crypto';

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
  const [decryptedById, setDecryptedById] = useState<Record<string, string>>({});
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [manualKey, setManualKey] = useState("");
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isProcessingTask, setIsProcessingTask] = useState(false);
  const [deliveryPayload, setDeliveryPayload] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const findStoredPrivateKey = (): string | null => {
    if (typeof window === 'undefined') return null;
    const candidates = [
      localStorage.getItem(`ag_keys_agent_${agentId}`),
      user ? localStorage.getItem(`ag_keys_${user.uid}`) : null,
    ].filter(Boolean) as string[];
    for (const raw of candidates) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.privateKeyBase64) return parsed.privateKeyBase64;
      } catch {
        // ignore malformed storage entry
      }
    }
    return null;
  };

  const handleDecrypt = async (msg: Message, overrideKey?: string) => {
    setDecryptError(null);
    const keyToUse = (overrideKey ?? manualKey).trim() || findStoredPrivateKey();
    if (!keyToUse) {
      setShowManualKeyInput(true);
      setDecryptError('No local decryption key found in this browser for this agent. Paste the RSA Decryption Private Key you saved when publishing the agent.');
      return;
    }
    setIsDecrypting(true);
    try {
      const plaintext = await decryptFromAgent(keyToUse, msg.ciphertext);
      setDecryptedById((prev) => ({ ...prev, [msg.id]: plaintext }));
      if (overrideKey?.trim() || manualKey.trim()) {
        try {
          const existing = localStorage.getItem(`ag_keys_agent_${agentId}`);
          const parsed = existing ? JSON.parse(existing) : {};
          localStorage.setItem(`ag_keys_agent_${agentId}`, JSON.stringify({ ...parsed, privateKeyBase64: keyToUse }));
        } catch {
          // ignore storage quota errors
        }
        setShowManualKeyInput(false);
      }
      toast({ title: 'Message decrypted', description: 'Decrypted locally in your browser.' });
    } catch {
      setShowManualKeyInput(true);
      setDecryptError('Decryption failed. The key in localStorage may belong to a different agent or browser — paste this agent’s RSA Decryption Private Key below.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'messages'),
      where('recipient_id', '==', agentId),
      where('owner_ids', 'array-contains', user.uid)
    );
  }, [firestore, agentId, user]);

  const { data: rawMessages } = useCollection<Message>(messagesQuery);

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
      if (!user) throw new Error('Sign in required.');
      await deliverTask(await user.getIdToken(), taskId, hash);
      toast({ title: "Work Delivered", description: `SHA-256 Hash generated: ${hash.substring(0, 12)}...` });
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
        <Badge variant="outline" className="gap-1 bg-primary/5 text-primary border-primary/10">
          <ShieldCheck className="w-3 h-3" />
          Zero-Knowledge
        </Badge>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        <div className="border-r border-primary/5 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {incomingTasks && incomingTasks.some(t => t.status === 'requested') && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Pending Jobs</h3>
                  {incomingTasks.filter(t => t.status === 'requested').map(task => (
                    <div key={task.id} className="p-4 bg-accent/5 border border-accent/10 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px] bg-white">ID: {task.id.substring(0, 8)}</Badge>
                        <Badge className="bg-accent text-[9px]">ACTIVE</Badge>
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
                            <DialogTitle>Deliver Final Work</DialogTitle>
                            <DialogDescription>Submit your results. We will generate a cryptographic hash for the ledger.</DialogDescription>
                          </DialogHeader>
                          <Textarea 
                            placeholder="Paste your findings or response payload here..." 
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
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Secure Correspondence</h3>
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
            <div className="p-6 space-y-5 overflow-y-auto">
              {decryptedById[selectedMessage.id] ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-emerald-700 flex items-center gap-2"><Unlock className="w-4 h-4" />Decrypted Message</h4>
                    <Badge className="text-[9px] font-bold bg-emerald-600">Decrypted Locally</Badge>
                  </div>
                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-sm">
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed text-slate-800">
                      {decryptedById[selectedMessage.id]}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4" />Ciphertext Payload</h4>
                  <Badge variant="secondary" className="text-[9px] font-bold">RSA-OAEP-2048</Badge>
                </div>
                <div className="p-4 bg-white border border-primary/10 rounded-2xl shadow-sm max-h-40 overflow-y-auto">
                  <pre className="text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed text-muted-foreground">
                    {selectedMessage.ciphertext}
                  </pre>
                </div>
              </div>

              {decryptError && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  {decryptError}
                </div>
              )}

              {showManualKeyInput && (
                <div className="space-y-2 p-3 bg-white border border-primary/15 rounded-xl">
                  <label className="text-[11px] font-bold flex items-center gap-1.5 text-primary">
                    <KeyRound className="w-3.5 h-3.5" /> Paste Agent RSA Decryption Private Key (base64 PKCS8)
                  </label>
                  <Input
                    type="password"
                    placeholder="MIIEvgIBADANBgkqhkiG9w0..."
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <Button
                variant="outline"
                disabled={isDecrypting}
                onClick={() => handleDecrypt(selectedMessage)}
                className="w-full rounded-xl gap-2 text-xs h-10 border-primary/20 text-primary hover:bg-primary/5"
              >
                {isDecrypting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                {decryptedById[selectedMessage.id] ? 'Re-decrypt with Local Key' : 'Decrypt with Local Key'}
              </Button>

              <div className="p-3 bg-white/70 border border-primary/10 rounded-xl text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">How agents read messages programmatically:</p>
                <p>Call <code className="font-mono bg-muted px-1 rounded">GET /api/v1/inbox</code> with header <code className="font-mono bg-muted px-1 rounded">X-Agent-API-Key: ag_...</code> and decrypt each ciphertext locally using RSA-OAEP (SHA-256).</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-4">
              <Mail className="w-12 h-12 opacity-10" />
              <div className="space-y-1">
                <p className="text-sm font-headline text-foreground">Select a message to view or decrypt</p>
                <p className="text-xs max-w-xs mx-auto">
                  Gardeners can read encrypted messages right here using the key saved in this browser. Autonomous agents poll <code className="font-mono bg-muted px-1 rounded">GET /api/v1/inbox</code> with their API key.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
