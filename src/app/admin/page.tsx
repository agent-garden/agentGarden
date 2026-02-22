'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Loader2, 
  ArrowLeft, 
  Users, 
  Ticket, 
  Plus, 
  Cpu,
  Inbox,
  CheckCircle,
  XCircle,
  Trash2,
  CheckSquare,
  Square,
  Mail,
  BellRing,
  Sparkles,
  Zap,
  Sprout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { collection, query, limit, orderBy, doc } from 'firebase/firestore';
import type { Agent, InviteCode, UserProfile, InviteRequest } from '@/app/lib/agents';
import { 
  batchGenerateInviteCodes, 
  approveInviteRequests, 
  rejectInviteRequests,
  resetAllUserInvites 
} from '@/app/actions/admin-actions';
import { seedGenesisAgents } from '@/app/actions/seed-agents';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();

  // Notification state
  const lastAgentCount = useRef<number | null>(null);
  const lastRequestCount = useRef<number | null>(null);

  // Fetch profile to check manual isAdmin field
  const profileRef = useMemoFirebase(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: profile } = useDoc<UserProfile>(profileRef);

  // ADMIN GUARD
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims.admin || profile?.isAdmin) {
          setIsAdmin(true);
        } else if (profile !== null) {
          setIsAdmin(false);
          toast({ variant: "destructive", title: "Access Denied", description: "Master Gardener privileges required." });
          router.push('/');
        }
      } catch (error) {
        setIsAdmin(false);
        router.push('/');
      }
    }
    if (!isUserLoading && profile !== undefined) {
      if (!user) router.push('/auth?redirect=/admin');
      else checkAdmin();
    }
  }, [user, isUserLoading, router, toast, profile]);

  const allAgentsQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "agents"), orderBy("createdAt", "desc"), limit(100)) : null, [db, isAdmin]);
  const inviteCodesQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "invite_codes"), orderBy("createdAt", "desc"), limit(100)) : null, [db, isAdmin]);
  const usersQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "users"), limit(100)) : null, [db, isAdmin]);
  const inviteRequestsQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "invite_requests"), orderBy("timestamp", "desc"), limit(100)) : null, [db, isAdmin]);

  const { data: agents } = useCollection<Agent>(allAgentsQuery);
  const { data: inviteCodes } = useCollection<InviteCode>(inviteCodesQuery);
  const { data: profiles } = useCollection<UserProfile>(usersQuery);
  const { data: inviteRequests, isLoading: isRequestsLoading } = useCollection<InviteRequest>(inviteRequestsQuery);

  // Real-time notifications
  useEffect(() => {
    if (agents) {
      if (lastAgentCount.current !== null && agents.length > lastAgentCount.current) {
        const newest = agents[0];
        toast({
          title: "🌱 Agent Planted",
          description: `${newest.name} (@${newest.handle}) indexed.`,
          action: <Zap className="w-4 h-4 text-primary" />,
        });
      }
      lastAgentCount.current = agents.length;
    }
  }, [agents, toast]);

  useEffect(() => {
    if (inviteRequests) {
      if (lastRequestCount.current !== null && inviteRequests.length > lastRequestCount.current) {
        toast({
          title: "🎟️ New Application",
          description: `A gardener is requesting access.`,
          action: <BellRing className="w-4 h-4 text-accent" />,
        });
      }
      lastRequestCount.current = inviteRequests.length;
    }
  }, [inviteRequests, toast]);

  const handleBatchGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    const result = await batchGenerateInviteCodes(user.uid);
    setIsGenerating(false);
    if (result.success) toast({ title: "Batch Generated" });
  };

  const handleSeedGenesis = async () => {
    if (!user) return;
    setIsSeeding(true);
    const result = await seedGenesisAgents(user.uid);
    setIsSeeding(false);
    if (result.success) toast({ title: "Genesis Seeded" });
  };

  const handleToggleRequest = (id: string) => {
    setSelectedRequests(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (!inviteRequests) return;
    const pendingIds = inviteRequests.filter(r => r.status === 'pending').map(r => r.id);
    setSelectedRequests(selectedRequests.length === pendingIds.length ? [] : pendingIds);
  };

  const handleApproveSelected = async () => {
    if (!user || selectedRequests.length === 0) return;
    setIsProcessing(true);
    const result = await approveInviteRequests(selectedRequests, user.uid);
    setIsProcessing(false);
    if (result.success) {
      toast({ title: "Applications Approved" });
      setSelectedRequests([]);
    }
  };

  const handleRejectSelected = async () => {
    if (!user || selectedRequests.length === 0) return;
    setIsProcessing(true);
    const result = await rejectInviteRequests(selectedRequests, user.uid);
    setIsProcessing(false);
    if (result.success) {
      toast({ title: "Applications Rejected" });
      setSelectedRequests([]);
    }
  };

  const handleResetInvites = async () => {
    if (!user) return;
    setIsProcessing(true);
    const result = await resetAllUserInvites(user.uid);
    setIsProcessing(false);
    if (result.success) toast({ title: "Allowances Refilled" });
  };

  if (isUserLoading || isAdmin === null) return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>);
  if (isAdmin === false) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50 h-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard"><ArrowLeft className="w-5 h-5 hover:text-primary transition-colors" /></Link>
          <h1 className="font-headline text-3xl text-primary flex items-center gap-2">
            <ShieldCheck className="w-8 h-8" /> Master Gardener Console
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-full h-12 bg-muted/50 p-1 mb-12">
            <TabsTrigger value="requests" className="rounded-full gap-2"><Inbox className="w-4 h-4" /> Applications</TabsTrigger>
            <TabsTrigger value="registry" className="rounded-full gap-2"><Ticket className="w-4 h-4" /> Registry</TabsTrigger>
            <TabsTrigger value="agents" className="rounded-full gap-2"><Cpu className="w-4 h-4" /> Manifest</TabsTrigger>
            <TabsTrigger value="users" className="rounded-full gap-2"><Users className="w-4 h-4" /> Residents</TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-3xl flex items-center gap-2"><Inbox className="w-8 h-8 text-primary" /> Pending</h2>
                {selectedRequests.length > 0 && (
                  <div className="flex items-center gap-3">
                    <Button onClick={handleApproveSelected} disabled={isProcessing} size="sm" className="rounded-full bg-green-600">
                      Approve ({selectedRequests.length})
                    </Button>
                    <Button onClick={handleRejectSelected} disabled={isProcessing} variant="destructive" size="sm" className="rounded-full">
                      Reject
                    </Button>
                  </div>
                )}
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 w-12"><Checkbox checked={selectedRequests.length > 0} onCheckedChange={handleSelectAll} /></th>
                      <th className="px-6 py-4 text-xs font-bold uppercase">Applicant</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase">Intended Use</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inviteRequests?.map((req) => (
                      <tr key={req.id} className="hover:bg-primary/5">
                        <td className="px-6 py-4">
                          <Checkbox 
                            disabled={req.status !== 'pending'}
                            checked={selectedRequests.includes(req.id)}
                            onCheckedChange={() => handleToggleRequest(req.id)}
                          />
                        </td>
                        <td className="px-6 py-4 font-bold">{req.name}<br/><span className="text-[10px] text-muted-foreground">{req.email}</span></td>
                        <td className="px-6 py-4 text-xs italic">{req.intended_use}</td>
                        <td className="px-6 py-4"><Badge>{req.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="registry">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-3xl flex items-center gap-2"><Ticket className="w-8 h-8 text-primary" /> Registry</h2>
                <Button onClick={handleBatchGenerate} disabled={isGenerating} className="rounded-full">Generate 10</Button>
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr><th className="px-6 py-4 text-xs font-bold uppercase">Code</th><th className="px-6 py-4 text-xs font-bold uppercase">Status</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {inviteCodes?.map(c => (
                      <tr key={c.id}>
                        <td className="px-6 py-4 font-mono font-bold">{c.id}</td>
                        <td className="px-6 py-4"><Badge variant={c.uses_left > 0 ? "default" : "secondary"}>{c.uses_left > 0 ? "Active" : "Used"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents">
             <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-3xl flex items-center gap-2"><Cpu className="w-8 h-8 text-primary" /> Manifest</h2>
                <Button onClick={handleSeedGenesis} disabled={isSeeding} variant="outline" className="rounded-full gap-2">
                  <Sprout className="w-4 h-4 text-primary" /> Seed Genesis
                </Button>
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <tbody className="divide-y">
                    {agents?.map(a => (
                      <tr key={a.id}>
                        <td className="px-6 py-4 font-bold">{a.name} <span className="text-xs font-mono text-muted-foreground">{a.handle}</span></td>
                        <td className="px-6 py-4"><Badge>{a.category}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-3xl flex items-center gap-2"><Users className="w-8 h-8 text-primary" /> Residents</h2>
                <Button variant="outline" size="sm" onClick={handleResetInvites} className="rounded-full">Refill All Allowance</Button>
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <tbody className="divide-y">
                    {profiles?.map(p => (
                      <tr key={p.id}>
                        <td className="px-6 py-4 font-bold">{p.displayName || p.email}</td>
                        <td className="px-6 py-4 font-bold text-primary">{p.invites_remaining} seeds</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
