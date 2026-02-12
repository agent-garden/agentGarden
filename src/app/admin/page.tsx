
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
  Ticket, 
  Plus, 
  Edit3,
  RefreshCw,
  Cpu,
  User as UserIcon,
  Inbox,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import type { Agent, InviteCode, UserProfile, InviteRequest } from '@/app/lib/agents';
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
        setIsAdmin(false);
      }
    }
    if (!isUserLoading) {
      if (!user) router.push('/auth?redirect=/admin');
      else checkAdmin();
    }
  }, [user, isUserLoading, router]);

  const allAgentsQuery = useMemoFirebase(() => db ? query(collection(db, "agents"), limit(100)) : null, [db]);
  const inviteCodesQuery = useMemoFirebase(() => db ? query(collection(db, "invite_codes"), orderBy("createdAt", "desc"), limit(100)) : null, [db]);
  const usersQuery = useMemoFirebase(() => db ? query(collection(db, "users"), limit(100)) : null, [db]);
  const inviteRequestsQuery = useMemoFirebase(() => db ? query(collection(db, "invite_requests"), orderBy("timestamp", "desc"), limit(100)) : null, [db]);

  const { data: agents } = useCollection<Agent>(allAgentsQuery);
  const { data: inviteCodes, isLoading: isCodesLoading } = useCollection<InviteCode>(inviteCodesQuery);
  const { data: profiles, isLoading: isProfilesLoading } = useCollection<UserProfile>(usersQuery);
  const { data: inviteRequests, isLoading: isRequestsLoading } = useCollection<InviteRequest>(inviteRequestsQuery);

  const handleBatchGenerate = async () => {
    if (!user) return;
    setIsGenerating(true);
    const result = await batchGenerateInviteCodes(user.uid);
    setIsGenerating(false);
    if (result.success) toast({ title: "Batch Generated", description: `10 codes created.` });
  };

  if (isUserLoading || isAdmin === null) return (<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>);
  if (isAdmin === false) return (<div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6"><ShieldAlert className="w-24 h-24 text-destructive" /><h1 className="font-headline text-5xl">Restricted Access</h1><Button asChild variant="outline"><Link href="/dashboard">Dashboard</Link></Button></div>);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="w-full border-b bg-white/50 backdrop-blur-md sticky top-0 z-50 h-20 flex items-center justify-between px-6">
        <div className="flex items-center gap-4"><Link href="/dashboard"><ArrowLeft className="w-5 h-5" /></Link><h1 className="font-headline text-3xl text-primary flex items-center gap-2"><ShieldCheck className="w-8 h-8" /> Master Gardener Console</h1></div>
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
              <h2 className="font-headline text-3xl flex items-center gap-2"><Inbox className="w-8 h-8 text-primary" /> Invite Applications</h2>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b">
                    <tr><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Applicant</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Intended Use</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Status</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest">Actions</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {isRequestsLoading ? (<tr><td colSpan={4} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></td></tr>) : 
                      inviteRequests?.map((req) => (
                      <tr key={req.id} className="hover:bg-primary/5">
                        <td className="px-6 py-4">
                          <div className="flex flex-col"><span className="font-bold">{req.name}</span><span className="text-[10px] text-muted-foreground">{req.email}</span></div>
                        </td>
                        <td className="px-6 py-4 text-xs italic text-foreground/80 max-w-xs truncate">"{req.intended_use}"</td>
                        <td className="px-6 py-4"><Badge variant={req.status === 'pending' ? 'secondary' : 'default'}>{req.status}</Badge></td>
                        <td className="px-6 py-4 flex items-center gap-2">
                          <Button size="sm" variant="ghost" className="rounded-full text-green-600"><CheckCircle className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" className="rounded-full text-red-600"><XCircle className="w-4 h-4" /></Button>
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
              <div className="flex items-center justify-between"><h2 className="font-headline text-3xl">Registry codes</h2><Button onClick={handleBatchGenerate} disabled={isGenerating} className="rounded-full"><Plus className="w-4 h-4 mr-2" />Batch 10</Button></div>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 border-b"><tr><th className="px-6 py-4 text-xs font-bold">Code</th><th className="px-6 py-4 text-xs font-bold">Status</th><th className="px-6 py-4 text-xs font-bold">Uses</th></tr></thead>
                  <tbody className="divide-y">{inviteCodes?.map(c => (<tr key={c.id}><td>{c.id}</td><td><Badge variant={c.uses_left > 0 ? 'default' : 'secondary'}>{c.uses_left > 0 ? 'Active' : 'Burned'}</Badge></td><td>{c.uses_left}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents">
            <div className="space-y-6">
              <h2 className="font-headline text-3xl">Manifest</h2>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <tbody className="divide-y">{agents?.map(a => (<tr key={a.id}><td className="px-6 py-4 font-bold">{a.name}</td><td className="px-6 py-4 text-xs">{a.handle}</td><td><Badge>{a.status}</Badge></td></tr>))}</tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="space-y-6">
              <h2 className="font-headline text-3xl">Gardener Management</h2>
              <div className="bg-white/60 rounded-3xl border shadow-sm overflow-hidden">
                <table className="w-full text-left">
                   <tbody className="divide-y">{profiles?.map(p => (<tr key={p.id}><td className="px-6 py-4 font-bold">{p.displayName}</td><td className="px-6 py-4">{p.invites_remaining} left</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
