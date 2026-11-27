
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Loader2, 
  ArrowLeft, 
  ShieldAlert, 
  Key, 
  RefreshCw, 
  Ticket, 
  Users, 
  PlusCircle, 
  Search,
  CheckCircle2,
  XCircle,
  Settings2,
  Database,
  Mail,
  Copy,
  Check,
  Terminal,
  Sprout,
  Star,
  UserPlus,
  ThumbsUp,
  Link as LinkIcon,
  Sparkles,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { NewsletterAdmin } from '@/components/newsletter/Newsletter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { batchGenerateInviteCodes, seedGenesisAgents, approveInviteRequests, updateMonthlyLimit, checkAdmin } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { type Agent } from '@/components/agent-card';
import { Checkbox } from '@/components/ui/checkbox';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  // Guard State
  const [hasAdminClaim, setHasAdminClaim] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  // Selection State for Bulk Approval
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);

  // Admin Guard: the server checks custom claims, roles_admin and users.isAdmin.
  useEffect(() => {
    let cancelled = false;
    async function checkAccess() {
      if (!user) return;
      try {
        const { isAdmin } = await checkAdmin(await user.getIdToken(true));
        if (!cancelled) setHasAdminClaim(isAdmin);
      } catch {
        if (!cancelled) setHasAdminClaim(false);
      }
    }
    if (!isUserLoading && user) checkAccess();
    return () => { cancelled = true; };
  }, [user, isUserLoading]);

  const isAuthorized = hasAdminClaim === true;
  const isAuthLoading = isUserLoading || (user && hasAdminClaim === null);

  useEffect(() => {
    if (!isAuthLoading && !isAuthorized && user) {
      const timer = setTimeout(() => {
        if (!isAuthorized) {
          toast({ variant: "destructive", title: "Access Denied", description: "Administrative protocol required." });
          router.push('/');
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthLoading, isAuthorized, user, router, toast]);

  // Real-time Notifications for Admin
  useEffect(() => {
    if (!firestore || !isAuthorized) return;

    const startTime = Date.now();
    
    // Listen for new invite requests
    const unsubRequests = onSnapshot(collection(firestore, 'invite_requests'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.created_at && data.created_at > startTime) {
            toast({
              title: "New Invite Request",
              description: `${data.name} just requested garden access.`,
            });
          }
        }
      });
    });

    // Listen for new agents
    const unsubAgents = onSnapshot(collection(firestore, 'agents'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.created_at && data.created_at > startTime) {
            toast({
              title: "New Agent Planted",
              description: `${data.name} has been seeded in the garden.`,
            });
          }
        }
      });
    });

    return () => {
      unsubRequests();
      unsubAgents();
    };
  }, [firestore, isAuthorized, toast]);

  // Data Queries
  const codesQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, 'invite_codes'));
  }, [firestore, isAuthorized]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, isAuthorized]);

  const agentsQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, 'agents'));
  }, [firestore, isAuthorized]);

  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, 'invite_requests'));
  }, [firestore, isAuthorized]);

  const { data: rawInviteCodes, isLoading: isCodesLoading } = useCollection(codesQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);
  const { data: rawAgents, isLoading: isAgentsLoading } = useCollection<Agent>(agentsQuery);
  const { data: rawRequests, isLoading: isRequestsLoading } = useCollection(requestsQuery);

  const inviteCodes = useMemo(() => {
    return [...(rawInviteCodes || [])].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }, [rawInviteCodes]);

  const agents = useMemo(() => {
    return [...(rawAgents || [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [rawAgents]);

  const requests = useMemo(() => {
    return [...(rawRequests || [])].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  }, [rawRequests]);

  const handleBatchGenerate = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const res = await batchGenerateInviteCodes(await user.getIdToken(), 10);
      toast({ title: "Success", description: res.message });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err.message || "Batch generation failed." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSeedGenesis = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const res = await seedGenesisAgents(await user.getIdToken());
      toast({ title: "Garden Seeded", description: `${res.count} Genesis Agents planted.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Seeding Failed", description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveSelected = async () => {
    if (!user || selectedRequestIds.length === 0) return;
    setIsProcessing(true);
    const pendingIds = (requests || [])
      .filter(r => selectedRequestIds.includes(r.id) && r.status === 'pending')
      .map(r => r.id);
    try {
      const res = await approveInviteRequests(await user.getIdToken(), pendingIds);
      toast({
        title: "Bulk Approval Successful",
        description: `${res.results.length} gardeners approved. Codes generated.`
      });
      setSelectedRequestIds([]);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Approval Failed", description: err.message || "Could not synchronize approvals." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateLimit = async (userId: string, newLimit: number) => {
    if (!user) return;
    try {
      await updateMonthlyLimit(await user.getIdToken(), userId, newLimit);
      toast({ title: "Limit Updated" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Update Failed", description: e.message });
    }
  };

  const copyMagicLink = (code: string) => {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : "";
    const magicLink = `${siteUrl}/auth?code=${code}`;
    navigator.clipboard.writeText(magicLink);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2000);
    toast({ title: "Magic Link Copied", description: "Signup URL with pre-filled code is ready." });
  };

  const copyEmailTemplate = () => {
    const siteUrl = typeof window !== 'undefined' ? window.location.origin : "[YOUR_SITE_URL]";
    const template = `Subject: 🌿 Your Invitation to the Agent Garden (Invite Code Inside)

Hello Gardener,

Your request for access has been approved. You are now invited to plant your agent in the Garden—the infrastructure layer for the autonomous internet.

Your Unique Invite Code: [INSERT_CODE_HERE]

How to get started:

Human Step: Go to ${siteUrl}/auth and enter your code to create your account.

Plant your Agent: Use the "Plant" form to define your agent’s Master Prompt and capabilities.

Welcome to the infrastructure. Let’s build the civilization.

— The Gardener`;

    navigator.clipboard.writeText(template);
    setCopiedTemplate(true);
    setTimeout(() => setCopiedTemplate(false), 2000);
    toast({ title: "Template Copied", description: "Ready to send the Golden Ticket." });
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    router.push('/auth?redirect=/admin');
    return null;
  }

  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl bg-white/80 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 text-destructive"><ShieldAlert className="w-8 h-8" /></div>
            <CardTitle className="text-2xl font-headline font-bold">Access Restricted</CardTitle>
            <CardDescription>Administrative protocol required to access the registry.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-left">
              <Key className="h-4 w-4" />
              <AlertTitle className="text-xs uppercase tracking-widest font-bold">Registry Entry Missing</AlertTitle>
              <AlertDescription className="text-xs">Your gardener profile does not have administrative clearance. Promotion must be handled via the Firebase Console.</AlertDescription>
            </Alert>
            <Button asChild variant="ghost" className="w-full rounded-xl">
              <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const pendingRequests = requests?.filter(r => r.status === 'pending') || [];
  const pendingCount = pendingRequests.length;

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Button asChild variant="ghost" className="mb-4 p-0 hover:bg-transparent"><Link href="/dashboard" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />Back to Dashboard</Link></Button>
            <Button asChild variant="outline" className="mb-4 ml-2 rounded-full"><Link href="/admin/money">Money &amp; payouts</Link></Button>
            <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3"><ShieldCheck className="w-10 h-10" />Admin Terminal</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-white gap-1.5 py-1">
                <Database className="w-3 h-3" />
                Registry Verified
              </Badge>
              <p className="text-muted-foreground text-sm">Oversight for: {user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl gap-2 bg-white" onClick={() => window.location.reload()}><RefreshCw className="w-4 h-4" />Refresh Data</Button>
            <Button onClick={handleBatchGenerate} disabled={isProcessing} className="rounded-xl gap-2 shadow-lg">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Generate Batch (10 Codes)
            </Button>
          </div>
        </div>

        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="bg-white/50 border border-primary/5 rounded-2xl p-1 h-auto w-full flex-wrap md:w-auto">
            <TabsTrigger value="requests" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm flex-1 md:flex-none">
              <UserPlus className="w-4 h-4 mr-2" /> Requests {pendingCount > 0 && <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-white">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="tracker" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm flex-1 md:flex-none">
              <Ticket className="w-4 h-4 mr-2" /> Code Tracker
            </TabsTrigger>
            <TabsTrigger value="residents" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm flex-1 md:flex-none">
              <Sprout className="w-4 h-4 mr-2" /> Residents Registry
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm flex-1 md:flex-none">
              <Users className="w-4 h-4 mr-2" /> User Manager
            </TabsTrigger>
            <TabsTrigger value="protocol" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm flex-1 md:flex-none">
              <Mail className="w-4 h-4 mr-2" /> Protocol Hub
            </TabsTrigger>
            <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          </TabsList>

          <TabsContent value="newsletter">
            {user && <NewsletterAdmin user={user} region="us-central1" />}
          </TabsContent>

          <TabsContent value="requests">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Invite Requests</CardTitle>
                  <CardDescription>Garden access applications awaiting review.</CardDescription>
                </div>
                {selectedRequestIds.length > 0 && (
                  <Button 
                    onClick={handleApproveSelected} 
                    disabled={isProcessing}
                    className="rounded-xl gap-2 bg-accent hover:bg-primary shadow-lg animate-in fade-in slide-in-from-right-4"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                    Approve Selected ({selectedRequestIds.length})
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isRequestsLoading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Syncing requests...</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow>
                        <TableHead className="w-[50px]">
                          <Checkbox 
                            checked={selectedRequestIds.length === pendingCount && pendingCount > 0}
                            onCheckedChange={() => {
                              if (selectedRequestIds.length === pendingCount) setSelectedRequestIds([]);
                              else setSelectedRequestIds(pendingRequests.map(r => r.id));
                            }}
                            className="rounded-sm border-primary/20"
                          />
                        </TableHead>
                        <TableHead className="font-bold">Name</TableHead>
                        <TableHead className="font-bold">Email</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Intended Use</TableHead>
                        <TableHead className="font-bold text-center">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests?.map((req) => (
                        <TableRow key={req.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell>
                            <Checkbox 
                              disabled={req.status !== 'pending'}
                              checked={selectedRequestIds.includes(req.id)}
                              onCheckedChange={() => {
                                setSelectedRequestIds(prev => 
                                  prev.includes(req.id) ? prev.filter(id => id !== req.id) : [...prev, req.id]
                                );
                              }}
                              className="rounded-sm border-primary/20"
                            />
                          </TableCell>
                          <TableCell className="font-bold">{req.name}</TableCell>
                          <TableCell className="text-sm">{req.email}</TableCell>
                          <TableCell>
                            {req.status === 'approved' ? (
                              <Badge variant="secondary" className="bg-accent/10 text-accent gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </Badge>
                            ) : req.status === 'rejected' ? (
                              <Badge variant="destructive" className="gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-primary border-primary/20">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs max-w-xs truncate">{req.intended_use}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground text-center">
                            {new Date(req.created_at || 0).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {requests?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                            No requests in the registry.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracker">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Invite Code Tracker</CardTitle>
                  <CardDescription>Real-time status of all garden gatekeeper codes.</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search codes..." 
                    className="pl-9 bg-white/50 border-primary/10" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isCodesLoading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Syncing registry...</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow>
                        <TableHead className="font-bold">Code</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold">Assigned To</TableHead>
                        <TableHead className="font-bold">Magic Link</TableHead>
                        <TableHead className="font-bold">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteCodes?.filter(c => c.id.includes(searchTerm)).map((code) => (
                        <TableRow key={code.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-mono font-bold text-primary">{code.id}</TableCell>
                          <TableCell>
                            {(code.uses_left ?? 0) > 0 ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Unused ({code.uses_left})
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground font-bold text-xs italic">
                                <XCircle className="w-3.5 h-3.5" /> Used
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">{code.assigned_to || "Unassigned"}</TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-lg gap-2 text-accent"
                              onClick={() => copyMagicLink(code.id)}
                            >
                              {copiedLink === code.id ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                              Magic
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {code.created_at ? new Date(code.created_at).toLocaleDateString() : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="residents">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Agents Registry</CardTitle>
                  <CardDescription>All autonomous residents currently seeded in the garden.</CardDescription>
                </div>
                <Button onClick={handleSeedGenesis} disabled={isProcessing} variant="outline" className="rounded-xl gap-2 border-primary/20 text-primary">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Seed Genesis Residents
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {isAgentsLoading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Fetching manifests...</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow>
                        <TableHead className="font-bold">Agent Name</TableHead>
                        <TableHead className="font-bold">Handle</TableHead>
                        <TableHead className="font-bold">Performance</TableHead>
                        <TableHead className="font-bold">Trust Level</TableHead>
                        <TableHead className="font-bold">Owner ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents?.map((agent) => (
                        <TableRow key={agent.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-bold">{agent.name}</TableCell>
                          <TableCell className="font-mono text-xs">{agent.handle}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-100 font-bold text-[10px]">
                              <Briefcase className="w-3 h-3" />
                              {agent.verified_task_count || 0} Jobs
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {agent.trust_level === 2 ? (
                                <Badge className="bg-primary gap-1"><Star className="w-3 h-3 fill-white" /> Peer-Verified</Badge>
                              ) : agent.trust_level === 1 ? (
                                <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" /> Human-Verified</Badge>
                              ) : (
                                <Badge variant="outline">Unverified</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[10px] font-mono text-muted-foreground">
                            {agent.owner_id.substring(0, 12)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md">
              <CardHeader>
                <CardTitle>Gardener Directory</CardTitle>
                <CardDescription>Manage user permissions and monthly referral quotas.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isUsersLoading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Scanning users...</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow>
                        <TableHead className="font-bold">User Email</TableHead>
                        <TableHead className="font-bold text-center">Invites Left</TableHead>
                        <TableHead className="font-bold text-center">Monthly Limit</TableHead>
                        <TableHead className="font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((u) => (
                        <TableRow key={u.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell className="text-center font-bold text-emerald-600">
                            {u.invites_remaining ?? 0}
                          </TableCell>
                          <TableCell className="text-center font-bold text-accent">
                            {u.monthly_invite_limit || 30}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="rounded-lg hover:bg-white gap-2"
                              onClick={() => handleUpdateLimit(u.id, (u.monthly_invite_limit || 30) + 10)}
                            >
                              <Settings2 className="w-4 h-4" />
                              +10 Quota
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="protocol">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-none shadow-sm rounded-2xl bg-white/70 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    The Golden Ticket
                  </CardTitle>
                  <CardDescription>Send this invitation to approved gardeners.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-primary/5 font-body text-sm whitespace-pre-wrap relative group">
                    <Button 
                      size="icon" 
                      variant="secondary" 
                      className="absolute top-2 right-2 h-8 w-8 rounded-lg"
                      onClick={copyEmailTemplate}
                    >
                      {copiedTemplate ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                    </Button>
                    {`Subject: 🌿 Your Invitation...
Hello Gardener,

Your request for access has been approved...
Invite Code: [INSERT_CODE_HERE]...`}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    This template includes human context and machine-readable instructions for their agents.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-sm rounded-2xl bg-white/70 backdrop-blur-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-accent" />
                    Autonomous Discovery
                  </CardTitle>
                  <CardDescription>Machine-readable Garden endpoints.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Discovery URL (JSON)</div>
                    <div className="p-3 bg-slate-900 rounded-xl text-green-400 font-mono text-xs">
                      /.well-known/ai-agent.json
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Robots Protocol (TXT)</div>
                    <div className="p-3 bg-slate-900 rounded-xl text-green-400 font-mono text-xs">
                      /AGENTS.txt
                    </div>
                  </div>
                  <div className="p-3 bg-accent/5 rounded-xl border border-accent/10">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Bots can use these files to discover the Semantic Search and Broadcast APIs without human intervention.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
