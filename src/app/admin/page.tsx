'use client';

import { useState, useEffect } from 'react';
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
  Database
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { makeAdmin, batchGenerateInviteCodes, updateMonthlyLimit } from '@/app/actions/admin';
import { useToast } from '@/hooks/use-toast';
import { collection, query, orderBy, doc } from 'firebase/firestore';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [hasAdminClaim, setHasAdminClaim] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Check for the DB-backed role as a fallback for the token claim
  const adminDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'roles_admin', user.uid);
  }, [firestore, user]);
  
  const { data: adminDoc, isLoading: isAdminDocLoading } = useDoc(adminDocRef);

  useEffect(() => {
    async function checkClaims() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult(true);
        setHasAdminClaim(!!idTokenResult.claims.admin);
      }
    }
    
    if (!isUserLoading && user) {
      checkClaims();
    }
  }, [user, isUserLoading]);

  // Unified Admin Check
  const isAuthorized = hasAdminClaim || !!adminDoc;
  const isAuthLoading = isUserLoading || isAdminDocLoading;

  // Queries only run if the user is confirmed as an admin to prevent permission errors
  const codesQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, 'invite_codes'), orderBy('created_at', 'desc'));
  }, [firestore, isAuthorized]);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore || !isAuthorized) return null;
    return query(collection(firestore, 'users'));
  }, [firestore, isAuthorized]);

  const { data: inviteCodes, isLoading: isCodesLoading } = useCollection(codesQuery);
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

  const handlePromoteSelf = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await makeAdmin(user.uid);
      toast({ 
        title: "Role Registry Updated", 
        description: "Administrative record created. The UI will unlock momentarily." 
      });
      // The useDoc hook will automatically pick up the new record
    } catch (err) {
      toast({ variant: "destructive", title: "Promotion Failed", description: "Check console for details." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchGenerate = async () => {
    setIsProcessing(true);
    try {
      await batchGenerateInviteCodes();
      toast({ title: "Success", description: "10 random codes generated." });
    } catch (err) {
      toast({ variant: "destructive", title: "Failed", description: "Batch generation failed." });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateLimit = async (userId: string, currentLimit: number) => {
    const newLimitRaw = prompt("Enter new monthly invite limit:", currentLimit.toString());
    if (newLimitRaw === null) return;
    const newLimit = parseInt(newLimitRaw);
    if (isNaN(newLimit)) return;

    try {
      await updateMonthlyLimit(userId, newLimit);
      toast({ title: "Updated", description: "User limit has been synchronized." });
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Failed to update limit." });
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!user) {
    router.push('/auth?redirect=/admin');
    return null;
  }

  // If both claim and DB record are missing, show the "Access Restricted" bootstrap UI
  if (!isAuthorized) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl bg-white/80 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 text-destructive"><ShieldAlert className="w-8 h-8" /></div>
            <CardTitle className="text-2xl font-headline font-bold">Access Restricted</CardTitle>
            <CardDescription>Administrative protocol required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20 text-left">
              <Key className="h-4 w-4" />
              <AlertTitle className="text-xs uppercase tracking-widest font-bold">Registry Entry Missing</AlertTitle>
              <AlertDescription className="text-xs">Your UID is not present in roles_admin.</AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground px-4">
              Click below to register your UID in the administrative registry. This will grant you access to manage the garden.
            </p>
            <Button onClick={handlePromoteSelf} disabled={isProcessing} className="w-full rounded-xl h-12 font-bold gap-2">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Grant Prototype Admin
            </Button>
            <Button asChild variant="ghost" className="w-full rounded-xl">
              <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Return to Garden</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Button asChild variant="ghost" className="mb-4 p-0 hover:bg-transparent"><Link href="/dashboard" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />Back to Garden</Link></Button>
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
              Batch Generate Codes (10)
            </Button>
          </div>
        </div>

        <Tabs defaultValue="tracker" className="space-y-6">
          <TabsList className="bg-white/50 border border-primary/5 rounded-2xl p-1 h-auto">
            <TabsTrigger value="tracker" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm">
              <Ticket className="w-4 h-4 mr-2" /> Code Tracker
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-6 py-3 data-[state=active]:shadow-sm">
              <Users className="w-4 h-4 mr-2" /> User Manager
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracker">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/70 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Invite Code Registry</CardTitle>
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
                        <TableHead className="font-bold">Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inviteCodes?.filter(c => c.id.includes(searchTerm)).map((code) => (
                        <TableRow key={code.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-mono font-bold text-primary">{code.id}</TableCell>
                          <TableCell>
                            {code.uses_left > 0 ? (
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
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(code.created_at || 0).toLocaleDateString()}
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
                <CardDescription>Manage user permissions and monthly invite quotas.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isUsersLoading ? (
                  <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Scanning users...</div>
                ) : (
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow>
                        <TableHead className="font-bold">User Email</TableHead>
                        <TableHead className="font-bold text-center">Monthly Limit</TableHead>
                        <TableHead className="font-bold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users?.map((u) => (
                        <TableRow key={u.id} className="hover:bg-primary/5 transition-colors">
                          <TableCell className="font-medium">{u.email}</TableCell>
                          <TableCell className="text-center font-bold text-accent">
                            {u.monthly_invite_limit || 5}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleUpdateLimit(u.id, u.monthly_invite_limit || 5)}
                              className="rounded-lg hover:bg-white gap-2"
                            >
                              <Settings2 className="w-4 h-4" />
                              Adjust Quota
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
        </Tabs>
      </div>
    </main>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
  return (
    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </div>
  );
}
