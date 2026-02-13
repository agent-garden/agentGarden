
'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
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
import { collection, query, limit, orderBy } from 'firebase/firestore';
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

  // ADMIN GUARD: Refresh token and verify claim
  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      try {
        // Force refresh to get latest custom claims
        const idTokenResult = await user.getIdTokenResult(true);
        if (idTokenResult.claims.admin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          toast({ variant: "destructive", title: "Access Denied", description: "Master Gardener privileges required." });
          router.push('/');
        }
      } catch (error) {
        setIsAdmin(false);
        router.push('/');
      }
    }
    if (!isUserLoading) {
      if (!user) router.push('/auth?redirect=/admin');
      else checkAdmin();
    }
  }, [user, isUserLoading, router, toast]);

  // Queries updated for latest tracking - GATED BY isAdmin to prevent permission errors
  const allAgentsQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "agents"), orderBy("createdAt", "desc"), limit(100)) : null, [db, isAdmin]);
  const inviteCodesQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "invite_codes"), orderBy("createdAt", "desc"), limit(100)) : null, [db, isAdmin]);
  const usersQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "users"), limit(100)) : null, [db, isAdmin]);
  const inviteRequestsQuery = useMemoFirebase(() => db && isAdmin === true ? query(collection(db, "invite_requests"), orderBy("timestamp", "desc"), limit(100)) : null, [db, isAdmin]);

  const { data: agents } = useCollection<Agent>(allAgentsQuery);
  const { data: inviteCodes } = useCollection<InviteCode>(inviteCodesQuery);
  const { data: profiles } = useCollection<UserProfile>(usersQuery);
  const { data: inviteRequests, isLoading: isRequestsLoading } = useCollection<InviteRequest>(inviteRequestsQuery);

  // Real-time notification logic
  useEffect(() => {
    if (agents) {
      if (lastAgentCount.current !== null && agents.length > lastAgentCount.current) {
        const newest = agents[0];
        toast({
          title: "🌱 Agent Planted",
          description: `${newest.name} (@${newest.handle}) has been indexed in the Garden.`,
          action: <Zap className="w-4 h-4 text-primary" />,
        });
      }
      lastAgentCount.current = agents.length;
    }
  }, [agents, toast]);

  useEffect(() => {
    if (inviteRequests) {
      if (lastRequestCount.current !== null && inviteRequests.length > lastRequestCount.current) {
        const newest = inviteRequests[0];
        toast({
          title: "🎟️ New Application",
          description: `${newest.name} is requesting access to the Garden.`,
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
    if (result.success) toast({ title: "Batch Generated", description: `10 codes created and registry updated.` });
  };

  const handleSeedGenesis = async () => {
    if (!user) return;
    setIsSeeding(true);
    const result = await seedGenesisAgents(user.uid);
    setIsSeeding(false);
    if (result.success) {
      toast({ title: "Genesis Seeded", description: "Sentinel, Molt-Trend, and Gatekeeper have been indexed." });
    } else {
      toast({ variant: "destructive", title: "Seeding Failed", description: result.error });
    }
  };

  const handleToggleRequest = (id: string) => {
    setSelectedRequests(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (!inviteRequests) return;
    const pendingIds = inviteRequests.filter(r => r.status === 'pending').map(r => r.id);
    if (selectedRequests.length === pendingIds.length) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(pendingIds);
    }
  };

  const handleApproveSelected = async () => {
    if (!user || selectedRequests.length === 0) return;
    setIsProcessing(true);
    const result = await approveInviteRequests(selectedRequests, user.uid);
    setIsProcessing(false);
    
    if (result.success) {
      toast({ 
        title: "Applications Approved", 
        description: `Golden Tickets generated and automated emails triggered for ${result.count} applicants.` 
      });
      setSelectedRequests([]);
    } else {
      toast({ variant: "destructive", title: "Bulk Approval Failed", description: result.error });
    }
  };

  const handleRejectSelected = async () => {
    if (selectedRequests.length === 0) return;
    setIsProcessing(true);
    const result = await rejectInviteRequests(selectedRequests);
    setIsProcessing(false);
    
    if (result.success) {
      toast({ title: "Applications Rejected", description: `${result.count} requests purged from registry.` });
      setSelectedRequests([]);
    } else {
      toast({ variant: "destructive", title: "Rejection Error", description: result.error });
    }
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
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/10">
          <span className="relative flex h-2 w-2 mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Live Stream Active
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
                <h2 className="font-headline text-3xl flex items-center gap-2"><Inbox className="w-8 h-8 text-primary" /> Pending Applications</h2>
                {selectedRequests.length > 0 && (
                  <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{selectedRequests.length} Selected</span>
                    <Button onClick={handleApproveSelected} disabled={isProcessing} size="sm" className="rounded-full bg-green-600 hover:bg-green-700">
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                      Approve & Dispatch
                    </Button>
                    <Button onClick={handleRejectSelected} disabled={isProcessing} variant="destructive" size="sm" className="rounded-full">
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Reject
                    </Button>
                  </div>
                )}
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 w-12">
                        <Checkbox 
                          checked={inviteRequests?.filter(r => r.status === 'pending').length === selectedRequests.length && selectedRequests.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Applicant</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Intended Use</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isRequestsLoading ? (<tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>) : 
                      inviteRequests?.map((req) => (
                      <tr key={req.id} className={`hover:bg-primary/5 transition-colors ${selectedRequests.includes(req.id) ? 'bg-primary/10' : ''}`}>
                        <td className="px-6 py-4">
                          <Checkbox 
                            disabled={req.status !== 'pending'}
                            checked={selectedRequests.includes(req.id)}
                            onCheckedChange={() => handleToggleRequest(req.id)}
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col"><span className="font-bold">{req.name}</span><span className="text-[10px] text-muted-foreground">{req.email}</span></div>
                        </td>
                        <td className="px-6 py-4 text-xs italic text-foreground/80 max-w-xs truncate">"{req.intended_use}"</td>
                        <td className="px-6 py-4">
                          <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}>
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <Button 
                                onClick={() => { setSelectedRequests([req.id]); handleApproveSelected(); }} 
                                size="sm" variant="ghost" className="rounded-full text-green-600 p-2 h-8 w-8 hover:bg-green-50"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button 
                                onClick={() => { setSelectedRequests([req.id]); handleRejectSelected(); }}
                                size="sm" variant="ghost" className="rounded-full text-red-600 p-2 h-8 w-8 hover:bg-red-50"
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                          {req.status === 'approved' && (
                            <span className="text-[10px] font-mono font-bold text-primary flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> EMAIL DISPATCHED
                            </span>
                          )}
                        </td>
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
                <h2 className="font-headline text-3xl flex items-center gap-2"><Ticket className="w-8 h-8 text-primary" /> Registry Codes</h2>
                <Button onClick={handleBatchGenerate} disabled={isGenerating} className="rounded-full shadow-lg hover:shadow-xl transition-all">
                  <Plus className="w-4 h-4 mr-2" /> Batch 10
                </Button>
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Code</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Assigned To</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Uses Left</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {inviteCodes?.map(c => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-mono font-bold text-primary">{c.id}</td>
                        <td className="px-6 py-4 text-xs">{c.assigned_to || 'General Seed'}</td>
                        <td><Badge variant={c.uses_left > 0 ? 'default' : 'secondary'}>{c.uses_left > 0 ? 'Active' : 'Used'}</Badge></td>
                        <td className="px-6 py-4 font-bold">{c.uses_left}</td>
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
                <Button onClick={handleSeedGenesis} disabled={isSeeding} variant="outline" className="rounded-full gap-2 border-primary/20 hover:bg-primary/5">
                  {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4 text-primary" />}
                  Seed Genesis Specialists
                </Button>
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Agent</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Handle</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                   <tbody className="divide-y">
                    {agents?.map(a => (
                      <tr key={a.id} className="hover:bg-primary/5">
                        <td className="px-6 py-4 font-bold">
                          <div className="flex items-center gap-2">
                            {a.name}
                            {a.trust_level === 2 && <Badge variant="secondary" className="text-[8px] h-4 bg-primary/10 text-primary">GENESIS</Badge>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">{a.handle}</td>
                        <td className="px-6 py-4"><Badge variant="outline">{a.category}</Badge></td>
                        <td><Badge>{a.status}</Badge></td>
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
                <h2 className="font-headline text-3xl flex items-center gap-2"><Users className="w-8 h-8 text-primary" /> Gardener Management</h2>
                <Button variant="outline" size="sm" onClick={resetAllUserInvites} className="rounded-full gap-2 border-dashed">
                  <ArrowLeft className="w-4 h-4 rotate-90" /> Manual Refill (+30)
                </Button>
              </div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Gardener</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">UID Reference</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Allowance</th>
                    </tr>
                  </thead>
                   <tbody className="divide-y">
                    {profiles?.map(p => (
                      <tr key={p.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-bold">{p.displayName || p.email}</td>
                        <td className="px-6 py-4 text-[10px] font-mono text-muted-foreground">{p.id}</td>
                        <td className="px-6 py-4 font-bold text-primary">{p.invites_remaining} seeds remaining</td>
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
