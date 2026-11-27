'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowLeft,
  Bot,
  CheckSquare,
  Clock,
  ExternalLink,
  GitBranch,
  Loader2,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { claimJobAsUser, getJobAsUser } from '@/app/actions/market';
import { SolanaWalletButton } from '@/components/solana-wallet-button';
import { explorerAddressUrl, explorerTxUrl } from '@/lib/solana';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = String(params?.id || '');
  const { user } = useUser();
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const [job, setJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const token = user ? await user.getIdToken() : null;
        const res = await getJobAsUser(token, jobId);
        if (!active) return;
        if (!res.ok) setError(res.error);
        else setJob(res.data);
      } catch (e: any) {
        if (active) setError(e?.message || 'Could not load job.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [jobId, user]);

  const handleClaim = async () => {
    if (!user || !job) return;
    setClaiming(true);
    try {
      const res = await claimJobAsUser(await user.getIdToken(), job.id, publicKey?.toBase58());
      if (!res.ok) throw new Error(res.error);
      setJob(res.data);
      toast({
        title: 'Task claimed!',
        description: 'Deliver your PR or output in My Garden → Wallet & Jobs.',
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not claim task', description: e?.message || 'Claim failed' });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F0FAF4] px-4 py-8 md:p-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button asChild variant="ghost" className="p-0 hover:bg-transparent">
            <Link href="/jobs" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />All Jobs</Link>
          </Button>
          <SolanaWalletButton compact />
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : error || !job ? (
          <Card className="rounded-3xl border-none shadow-sm p-8 text-center space-y-3">
            <p className="font-headline font-bold text-lg text-destructive">{error || 'Job not found.'}</p>
            <Button asChild variant="outline" className="rounded-full"><Link href="/jobs">Back to Job Board</Link></Button>
          </Card>
        ) : (
          <Card className="rounded-3xl border border-primary/10 shadow-sm bg-white overflow-hidden">
            <CardHeader className="space-y-3 border-b border-primary/5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="uppercase text-[10px] font-bold">{job.status}</Badge>
                    {job.fulfillment_mode === 'human_operator' && (
                      <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                        <Sparkles className="w-3 h-3" /> Human + AI Coding Tools
                      </Badge>
                    )}
                    {job.fulfillment_mode === 'autonomous_agent' && (
                      <Badge variant="outline" className="rounded-full bg-sky-50 text-sky-700 border-sky-200 gap-1">
                        <Bot className="w-3 h-3" /> Autonomous Agent
                      </Badge>
                    )}
                    {job.github_issue_url && (
                      <a
                        href={job.github_issue_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-700"
                      >
                        <GitBranch className="w-3 h-3" /> {job.github_repo || 'GitHub Issue'} <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  <CardTitle className="text-2xl md:text-3xl font-headline break-words">{job.title}</CardTitle>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-bold text-primary">{job.budget}</div>
                  <div className="text-xs text-muted-foreground">
                    {job.is_volunteer ? 'open-source / karma' : `worker gets ${job.worker_gets}`}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">{job.poster_type === 'agent' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}{job.poster_name}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.deadline_hours}h deadline</span>
                {job.preferred_model && <span>Preferred: <strong>{job.preferred_model}</strong>{job.preferred_effort ? ` (${job.preferred_effort})` : ''}</span>}
                <span className="font-mono opacity-70">id {job.id}</span>
              </div>
            </CardHeader>

            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Specification</h3>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{job.description}</div>
              </div>

              {job.acceptance_criteria && (
                <div className="p-4 rounded-2xl bg-muted/40 border space-y-1.5">
                  <p className="text-xs font-bold flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-primary" /> Acceptance Criteria</p>
                  <div className="text-sm whitespace-pre-wrap text-muted-foreground">{job.acceptance_criteria}</div>
                </div>
              )}

              {(job.skills || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {job.skills.map((s: string) => <Badge key={s} variant="secondary" className="rounded-full">{s}</Badge>)}
                </div>
              )}

              {job.escrow_mode === 'smart_contract' && job.escrow_pda && (
                <div className="p-3 rounded-xl bg-[#9945FF]/5 border border-[#9945FF]/20 text-xs flex flex-wrap items-center gap-3">
                  <span className="font-bold text-[#7C2AE8] flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> Solana PDA Escrow:</span>
                  <a href={explorerAddressUrl(job.escrow_pda)} target="_blank" rel="noopener noreferrer" className="font-mono underline">{job.escrow_pda}</a>
                  {job.escrow_tx && <a href={explorerTxUrl(job.escrow_tx)} target="_blank" rel="noopener noreferrer" className="underline">escrow tx</a>}
                </div>
              )}

              {job.status === 'open' && job.fulfillment_mode !== 'autonomous_agent' && job.escrow_mode !== 'smart_contract' && (
                <div className="pt-2 border-t border-primary/5 flex justify-end">
                  {user ? (
                    <Button className="rounded-full gap-2 px-6" disabled={claiming} onClick={handleClaim}>
                      {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Claim This Task
                    </Button>
                  ) : (
                    <Button asChild className="rounded-full px-6">
                      <Link href={`/auth?redirect=/jobs/${job.id}`}>Sign in to claim</Link>
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
