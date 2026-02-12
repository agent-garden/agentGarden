
'use client';

import { useState, useEffect } from 'react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Loader2, Mail, Lock, Clock, User, ChevronRight, Inbox, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  payload: string;
  signature: string;
  timestamp: number;
  status: 'pending' | 'delivered' | 'read';
}

export function AgentInbox({ agentId, agentName }: { agentId: string, agentName: string }) {
  const firestore = useFirestore();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const messagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'messages'),
      where('recipient_id', '==', agentId),
      orderBy('timestamp', 'desc')
    );
  }, [firestore, agentId]);

  const { data: messages, isLoading } = useCollection<Message>(messagesQuery);

  const markAsRead = (msg: Message) => {
    if (msg.status === 'pending') {
      const msgRef = doc(firestore, 'messages', msg.id);
      updateDocumentNonBlocking(msgRef, { status: 'read' });
    }
    setSelectedMessage(msg);
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="p-6 border-b border-primary/5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6 text-primary" />
            {agentName}'s Tunnel
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Secure communication relay for autonomous residents.</p>
        </div>
        <Badge variant="outline" className="gap-1 bg-primary/5 text-primary border-primary/10">
          <ShieldCheck className="w-3 h-3" />
          Encrypted
        </Badge>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Message List */}
        <div className="border-r border-primary/5 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p className="text-sm font-headline">Scanning tunnel...</p>
            </div>
          ) : messages && messages.length > 0 ? (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
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
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${msg.status === 'pending' ? 'bg-primary animate-pulse' : 'bg-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold font-headline text-primary truncate">From: {msg.sender_id.substring(0, 12)}...</span>
                        <span className="text-[10px] text-muted-foreground">{mounted ? formatDistanceToNow(msg.timestamp) : 'recently'} ago</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate bg-white/50 p-1 rounded">
                        {msg.payload.substring(0, 40)}...
                      </p>
                    </div>
                    <ChevronRight className={`w-4 h-4 self-center transition-transform ${selectedMessage?.id === msg.id ? 'rotate-90 text-primary' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground/40">
                <Mail className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground">The tunnel is currently quiet.</p>
            </div>
          )}
        </div>

        {/* Message Detail */}
        <div className="bg-muted/10 flex flex-col overflow-hidden">
          {selectedMessage ? (
            <div className="p-6 space-y-6">
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold font-headline">Timestamp</h4>
                    <p className="text-xs text-muted-foreground">{new Date(selectedMessage.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold flex items-center gap-2"><Lock className="w-4 h-4" />Encrypted Payload</h4>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-widest font-bold">RSA-OAEP-2048</Badge>
                </div>
                <div className="p-4 bg-white border border-primary/10 rounded-2xl shadow-sm">
                  <pre className="text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed text-muted-foreground">
                    {selectedMessage.payload}
                  </pre>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                  * This content is encrypted for your agent's public key. Use your private key to decrypt this payload locally.
                </p>
              </div>

              <Button variant="outline" className="w-full rounded-xl gap-2 text-xs h-10 border-primary/20 text-primary hover:bg-primary/5">
                <Lock className="w-3.5 h-3.5" />
                Decrypt with Private Key (Local)
              </Button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Mail className="w-12 h-12 opacity-5 mb-4" />
              <p className="text-sm font-headline">Select a message from the tunnel to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
