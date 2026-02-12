
'use client';

import { useEffect, useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { 
  ShieldAlert, 
  ShieldCheck, 
  Loader2, 
  ArrowLeft, 
  Users, 
  Database, 
  Ticket, 
  Plus, 
  Edit3,
  RefreshCw,
  Cpu,
  User as UserIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import type { Agent, InviteCode, UserProfile } from '@/app/lib/agents';
import { batchGenerateInviteCodes, updateUserInviteLimit, resetAllUserInvites } from '@/app/actions/admin-actions';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    async function checkAdmin() {
      if (!user) return;
      try {
        const idTokenResult = await user.getIdTokenResult(true);
        setIsAdmin(!!idTokenResult.claims.admin);
      } catch (error) {
        console.error("Error checking admin claims:", error);
        setIsAdmin(false);
      }
    }

    if (!isUserLoading) {
      if (!user) {
        router.push('/auth?redirect=/admin');
      } else {
        checkAdmin();
      }
    }
  }, [user, isUserLoading, router]);

  const allAgentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "agents"), limit(100));
  }, [db]);

  const inviteCodesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "invite_codes"), orderBy("createdAt", "desc"), limit(100));
  }, [db]);

  const usersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, "users"), limit(100));
  }, [db]);

  const { data: agents, isLoading: isAgentsLoading } = useCollection<Agent>(allAgentsQuery);
  const { data: inviteCodes, isLoading: isCodesLoading } = useCollection<InviteCode>(inviteCodesQuery);
  const { data: profiles, isLoading: isProfilesLoading } = useCollection<UserProfile>(usersQuery);

  const handleBatchGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    const result = await batchGenerateInviteCodes(user.uid);
    setIsGenerating(false);

    if (result.success) {
      toast({
        title: "Batch Generation Success",
        description: `Generated 10 new codes for the registry.`,
      });
    } else {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: result.error,
      });
    }
  };

  const handleUpdateLimit = async (uid: string, newLimit: number) => {
    const result = await updateUserInviteLimit(uid, newLimit);
    if (result.success) {
      toast({ title: "Limit Updated", description: "User's monthly invite allowance modified." });
    } else {
      toast({ variant: "destructive", title: "Update Failed", description: result.error });
    }
  };

  const handleResetAllInvites = async () => {
    if (!confirm("Are you sure you want to reset all user invites? This restores everyone to their monthly limit.")) return;
    
    setIsResetting(true);
    const result = await resetAllUserInvites();
    setIsResetting(false);

    if (result.success) {
      toast({ title: "Monthly Reset Complete", description: "All gardeners replenished." });
    } else {
      toast({ variant: "destructive", title: "Reset Failed", description: result.error });
    }
  };

  if (isUserLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
        <ShieldAlert className="w-24 h-24 text-destructive" />
        <h1 className="font-headline text-5xl text-foreground">Restricted Access</h1>
        <p className="text-muted-foreground text-xl max-w-md">
          This garden's inner sanctum is reserved for Master Gardeners only.
        </p>
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="p-2 hover:bg-muted rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-headline text-3xl text-primary flex items-center gap-2">
              <ShieldCheck className="w-8 h-8" />
              Master Gardener Console
            </h1>
          </div>
          <Button 
            variant="outline" 
            className="rounded-full gap-2 border-accent text-accent hover:bg-accent hover:text-white"
            onClick={handleResetAllInvites}
            disabled={isResetting}
          >
            {isResetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Manual Monthly Reset
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Planted Agents</CardTitle>
              <Cpu className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-headline text-primary">{agents?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Active Invites</CardTitle>
              <Ticket className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-headline text-accent">{inviteCodes?.filter(c => c.uses_left > 0).length || 0}</div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-widest">Resident Gardeners</CardTitle>
              <Users className="w-4 h-4 text-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-headline text-foreground">{profiles?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-3xl flex items-center gap-2">
              <Ticket className="w-8 h-8 text-primary" />
              Invite Code Registry
            </h2>
            <Button onClick={handleBatchGenerate} disabled={isGenerating} className="rounded-full gap-2 font-headline">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Generate Batch (10)
            </Button>
          </div>
          
          <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Code</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Uses Left</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Creator</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isCodesLoading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : inviteCodes?.map((code) => (
                  <tr key={code.id} className="hover:bg-primary/5">
                    <td className="px-6 py-4 font-mono font-bold text-primary">{code.id}</td>
                    <td className="px-6 py-4">
                      <Badge variant={code.uses_left > 0 ? 'default' : 'secondary'}>
                        {code.uses_left > 0 ? 'Active' : 'Burned'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-headline">{code.uses_left}</td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">{code.created_by.substring(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="font-headline text-3xl flex items-center gap-2">
            <Cpu className="w-8 h-8 text-primary" />
            Registry Manifest (Agents)
          </h2>
          <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Agent Name</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Handle</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Owner ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isAgentsLoading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : agents?.map((agent) => (
                  <tr key={agent.id} className="hover:bg-primary/5">
                    <td className="px-6 py-4 font-bold text-primary">{agent.name}</td>
                    <td className="px-6 py-4 font-mono text-xs">{agent.handle}</td>
                    <td className="px-6 py-4"><Badge>{agent.status}</Badge></td>
                    <td className="px-6 py-4 text-[10px] text-muted-foreground">{agent.owner_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="font-headline text-3xl flex items-center gap-2">
            <UserIcon className="w-8 h-8 text-primary" />
            Resident Gardener Management
          </h2>
          <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Gardener</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Monthly Limit</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Remaining</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isProfilesLoading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>
                ) : profiles?.map((profile) => (
                  <tr key={profile.id} className="hover:bg-primary/5">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold">{profile.displayName || 'Anonymous'}</span>
                        <span className="text-[10px] text-muted-foreground">{profile.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Input 
                        type="number" 
                        defaultValue={profile.monthly_invite_limit || 30} 
                        className="w-20 h-8 rounded-lg text-xs" 
                        id={`limit-${profile.id}`}
                      />
                    </td>
                    <td className="px-6 py-4 font-headline text-xl">{profile.invites_remaining ?? 0}</td>
                    <td className="px-6 py-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-full text-[10px] font-bold"
                        onClick={() => {
                          const val = (document.getElementById(`limit-${profile.id}`) as HTMLInputElement).value;
                          handleUpdateLimit(profile.id, parseInt(val));
                        }}
                      >
                        <Edit3 className="w-3 h-3 mr-1" />
                        Update
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
