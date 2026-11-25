'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Landmark } from 'lucide-react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { adminGrantSolCredit, adminMarket, adminResolveDispute, adminSettlePayout } from '@/app/actions/market';
import { formatSol, solToLamports } from '@/lib/solana';

type Stats = Extract<Awaited<ReturnType<typeof adminMarket>>, { ok: true }>['data'];
const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function AdminMoneyPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [s, setS] = useState<Stats | null>(null);
  const [denied, setDenied] = useState<string | null>(null);
  const [who, setWho] = useState('');
  const [amountSol, setAmountSol] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const res = await adminMarket(await user.getIdToken());
    if (res.ok) setS(res.data);
    else setDenied(res.error);
  }, [user]);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth?redirect=/admin/money');
    load();
  }, [isUserLoading, user, router, load]);

  const act = async (fn: (t: string) => Promise<{ ok: boolean; error?: string }>, done: string) => {
    if (!user) return;
    setBusy(true);
    const res = await fn(await user.getIdToken());
    setBusy(false);
    if (res.ok) {
      toast({ title: done });
      load();
    } else toast({ variant: 'destructive', title: 'Failed', description: res.error });
  };

  if (denied) return <main className="p-12 text-center">{denied}</main>;
  if (!s) return <main className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></main>;

  const tiles = [
    ['SOL revenue (fees)', formatSol(s.fees_lamports)],
    ['SOL job volume', formatSol(s.gross_volume_lamports)],
    ['SOL deposits', formatSol(s.topups_lamports)],
    ['SOL paid out', formatSol(s.payouts_lamports)],
    ['Jobs completed', String(s.jobs_completed)],
    ['Open jobs', String(s.open_jobs)],
    ['Solana cluster', s.solana_cluster],
    ['Fee rate', `${s.fee_bps / 100}%`],
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <Button asChild variant="ghost" className="p-0"><Link href="/admin"><ArrowLeft className="w-4 h-4 mr-2" />Admin</Link></Button>
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3"><Landmark className="w-9 h-9" />Solana Treasury &amp; Money</h1>
          <p className="text-xs font-mono text-muted-foreground mt-2">
            Program: {s.solana_program_id} · Treasury: {s.solana_treasury || 'Not configured'}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tiles.map(([k, v]) => (
            <Card key={k} className="rounded-2xl border-none shadow-sm"><CardHeader className="pb-1"><CardDescription>{k}</CardDescription></CardHeader><CardContent className="text-2xl font-bold">{v}</CardContent></Card>
          ))}
        </div>

        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader><CardTitle>Grant SOL credit</CardTitle><CardDescription>Add promo or test SOL balance to a gardener’s wallet.</CardDescription></CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-2">
            <Input placeholder="Email or user id" value={who} onChange={(e) => setWho(e.target.value)} />
            <Input placeholder="Amount (SOL)" type="number" step="0.05" value={amountSol} onChange={(e) => setAmountSol(e.target.value)} className="md:w-36" />
            <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button disabled={busy} onClick={() => act((t) => adminGrantSolCredit(t, who, solToLamports(amountSol), note), 'SOL credit added')}>Grant SOL</Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader><CardTitle>Withdrawal requests ({s.payouts.length})</CardTitle><CardDescription>Send SOL on-chain (or legacy fiat), then mark paid.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {s.payouts.length === 0 && <p className="text-sm text-muted-foreground">None pending.</p>}
            {s.payouts.map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-xl">
                <div className="min-w-0">
                  <p className="font-bold">{p.currency === 'SOL' ? formatSol(p.amount_lamports) : $(p.amount_cents)}</p>
                  <p className="text-sm font-mono break-all">{p.solana_address || p.method}</p>
                  <p className="text-xs text-muted-foreground font-mono">{p.owner_id} · {new Date(p.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act((t) => adminSettlePayout(t, p.id, 'paid', ''), 'Marked paid')}>Mark paid</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act((t) => adminSettlePayout(t, p.id, 'rejected', 'Returned by admin'), 'Returned to balance')}>Reject</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-none shadow-sm">
          <CardHeader><CardTitle>Disputes ({s.disputes.length})</CardTitle><CardDescription>Read the job and the submitted work, then decide who gets the escrow.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            {s.disputes.length === 0 && <p className="text-sm text-muted-foreground">No disputes.</p>}
            {s.disputes.map((j) => (
              <div key={j.id} className="p-4 bg-muted/40 rounded-xl space-y-2">
                <p className="font-bold break-words">{j.title} · {j.budget}</p>
                <p className="text-sm whitespace-pre-line break-words">{j.description}</p>
                <p className="text-sm"><strong>Complaint:</strong> {j.dispute_reason}</p>
                {j.deliverable?.text && <pre className="text-xs whitespace-pre-wrap break-words max-h-60 overflow-y-auto bg-white p-2 rounded">{j.deliverable.text}</pre>}
                {j.deliverable?.url && <a className="text-sm underline break-all" href={j.deliverable.url} target="_blank" rel="noopener noreferrer nofollow">{j.deliverable.url}</a>}
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => act((t) => adminResolveDispute(t, j.id, 'pay_worker', ''), 'Worker paid')}>Pay {j.provider_name}</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => act((t) => adminResolveDispute(t, j.id, 'refund_poster', ''), 'Poster refunded')}>Refund poster</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
