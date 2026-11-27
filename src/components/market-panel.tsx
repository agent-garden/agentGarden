'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  Loader2,
  Wallet,
  ArrowDownToLine,
  Coins,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  XCircle,
  Bot,
  ExternalLink,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SolanaWalletButton } from '@/components/solana-wallet-button';
import {
  cancelJobAsUser,
  confirmSolDeposit,
  getMyMarket,
  reviewJobAsUser,
  setSolAllowance,
  startTopup,
  submitWorkAsUser,
  releaseJobAsUser,
  updateAgentSolanaWallet,
  withdrawSol,
} from '@/app/actions/market';
import {
  buildAcceptAndReleaseInstruction,
  buildCancelJobInstruction,
  buildDisputeJobInstruction,
  buildRequestRevisionInstruction,
  explorerAddressUrl,
  explorerTxUrl,
  formatSol,
  lamportsToSol,
  solToLamports,
} from '@/lib/solana';

type Market = Extract<Awaited<ReturnType<typeof getMyMarket>>, { ok: true }>['data'];
type Job = Market['posted'][number];

const $ = (c: number) => `$${(c / 100).toFixed(2)}`;

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-sky-100 text-sky-800',
  claimed: 'bg-amber-100 text-amber-800',
  submitted: 'bg-violet-100 text-violet-800',
  completed: 'bg-emerald-100 text-emerald-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
  refunded: 'bg-gray-100 text-gray-700',
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-full ${STATUS_COLORS[status] || ''}`}>{status}</span>;
}

function Deliverable({ job }: { job: Job }) {
  if (!job.deliverable) return null;
  return (
    <div className="p-3 bg-muted/40 rounded-xl space-y-2 text-sm">
      {job.deliverable.ai_tools_used && (
        <p className="text-xs text-muted-foreground">
          <strong>AI Tools Used:</strong> {job.deliverable.ai_tools_used}
        </p>
      )}
      {job.deliverable.github_pr_url && (
        <a href={job.deliverable.github_pr_url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary font-medium underline inline-flex items-center gap-1 break-all">
          GitHub PR: {job.deliverable.github_pr_url} <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      )}
      {job.deliverable.text && <pre className="whitespace-pre-wrap break-words font-body max-h-80 overflow-y-auto">{job.deliverable.text}</pre>}
      {job.deliverable.url && job.deliverable.url !== job.deliverable.github_pr_url && (
        <a href={job.deliverable.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline inline-flex items-center gap-1 break-all">
          {job.deliverable.url} <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      )}
    </div>
  );
}

export function MarketPanel({ user }: { user: User }) {
  const { toast } = useToast();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [m, setM] = useState<Market | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [prUrls, setPrUrls] = useState<Record<string, string>>({});
  const [aiTools, setAiTools] = useState<Record<string, string>>({});
  const [workNotes, setWorkNotes] = useState<Record<string, string>>({});
  const [depositSol, setDepositSol] = useState('0.5');
  const [manualTxSig, setManualTxSig] = useState('');
  const [withdrawAmountSol, setWithdrawAmountSol] = useState('');
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [topupUsd, setTopupUsd] = useState('20');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [allowances, setAllowances] = useState<Record<string, string>>({});
  const [agentWallets, setAgentWallets] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await getMyMarket(await user.getIdToken());
    if (res.ok) setM(res.data);
    else toast({ variant: 'destructive', title: 'Could not load your wallet', description: res.error });
  }, [user, toast]);

  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search).get('topup');
    if (p === 'success') toast({ title: 'Payment received', description: 'Your credit appears shortly.' });
  }, [load, toast]);

  useEffect(() => {
    if (publicKey && !withdrawAddr) {
      setWithdrawAddr(publicKey.toBase58());
    }
  }, [publicKey, withdrawAddr]);

  const act = async (key: string, fn: (token: string) => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(key);
    const res = await fn(await user.getIdToken());
    setBusy(null);
    if (!res.ok) toast({ variant: 'destructive', title: 'Action failed', description: res.error });
    else {
      toast({ title: success });
      load();
    }
  };

  const depositViaWallet = async () => {
    if (!m?.solanaTreasury) {
      toast({ variant: 'destructive', title: 'Treasury not configured', description: 'Set NEXT_PUBLIC_SOLANA_TREASURY in your environment.' });
      return;
    }
    if (!connected || !publicKey) {
      toast({ variant: 'destructive', title: 'Connect Solana wallet', description: 'Connect Phantom or Solflare first.' });
      return;
    }
    const lamports = solToLamports(depositSol);
    if (lamports < 1_000_000) {
      toast({ variant: 'destructive', title: 'Amount too small', description: 'Minimum SOL deposit is 0.001 SOL.' });
      return;
    }
    setBusy('sol_deposit');
    try {
      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(m.solanaTreasury),
          lamports,
        })
      );
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, 'confirmed');
      const res = await confirmSolDeposit(await user.getIdToken(), sig);
      if (!res.ok) throw new Error(res.error);
      toast({ title: 'SOL deposited!', description: `${formatSol(res.data.lamports)} credited to your Agent Garden wallet.` });
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Deposit failed', description: err instanceof Error ? err.message : 'Transaction rejected' });
    } finally {
      setBusy(null);
    }
  };

  const verifyManualDeposit = async () => {
    if (!manualTxSig.trim()) return;
    await act(
      'manual_verify',
      (t) => confirmSolDeposit(t, manualTxSig.trim()),
      'SOL deposit verified and credited'
    );
    setManualTxSig('');
  };

  const handleReviewJob = async (job: Job, decision: 'accept' | 'revise' | 'dispute') => {
    if (job.escrow_mode === 'smart_contract') {
      if (!connected || !publicKey) {
        toast({ variant: 'destructive', title: 'Connect Solana wallet', description: 'You must sign the smart-contract instruction with your poster wallet.' });
        return;
      }
      if (!m?.solanaTreasury) {
        toast({ variant: 'destructive', title: 'Treasury not configured' });
        return;
      }
      setBusy(job.id);
      try {
        let ix;
        if (decision === 'accept') {
          if (!job.worker_wallet) throw new Error('Worker Solana wallet missing on job.');
          ix = (await buildAcceptAndReleaseInstruction({
            poster: publicKey,
            worker: new PublicKey(job.worker_wallet),
            treasury: new PublicKey(m.solanaTreasury),
            jobId: job.id,
          })).instruction;
        } else if (decision === 'revise') {
          ix = (await buildRequestRevisionInstruction({ poster: publicKey, jobId: job.id })).instruction;
        } else {
          ix = (await buildDisputeJobInstruction({ poster: publicKey, jobId: job.id })).instruction;
        }
        const tx = new Transaction().add(ix);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, 'confirmed');

        const res = await reviewJobAsUser(await user.getIdToken(), job.id, decision, feedback[job.id], sig);
        if (!res.ok) throw new Error(res.error);
        toast({ title: decision === 'accept' ? `Settled on-chain! ${job.worker_gets} sent to worker.` : 'On-chain status updated.' });
        load();
      } catch (err) {
        toast({ variant: 'destructive', title: 'Smart contract call failed', description: err instanceof Error ? err.message : 'Error' });
      } finally {
        setBusy(null);
      }
      return;
    }

    await act(
      job.id,
      (t) => reviewJobAsUser(t, job.id, decision, feedback[job.id]),
      decision === 'accept' ? `Accepted. ${job.worker_gets} paid to the agent.` : decision === 'revise' ? 'Sent back for changes' : 'Dispute opened'
    );
  };

  const handleCancelJob = async (job: Job) => {
    if (job.escrow_mode === 'smart_contract') {
      if (!connected || !publicKey) {
        toast({ variant: 'destructive', title: 'Connect Solana wallet', description: 'Sign `cancel_job` with your poster wallet to reclaim SOL.' });
        return;
      }
      setBusy(job.id);
      try {
        const { instruction } = await buildCancelJobInstruction({ poster: publicKey, jobId: job.id });
        const tx = new Transaction().add(instruction);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, 'confirmed');

        const res = await cancelJobAsUser(await user.getIdToken(), job.id, sig);
        if (!res.ok) throw new Error(res.error);
        toast({ title: 'Escrow closed & SOL refunded on-chain!' });
        load();
      } catch (err) {
        toast({ variant: 'destructive', title: 'Cancel failed', description: err instanceof Error ? err.message : 'Error' });
      } finally {
        setBusy(null);
      }
      return;
    }

    await act(job.id, (t) => cancelJobAsUser(t, job.id), 'Cancelled and refunded');
  };

  const addCardFunds = async () => {
    setBusy('topup');
    const res = await startTopup(await user.getIdToken(), Math.round(Number(topupUsd) * 100));
    setBusy(null);
    if (!res.ok) toast({ variant: 'destructive', title: 'Checkout unavailable', description: res.error });
    else window.location.href = res.data.url;
  };

  if (!m) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  const w = m.wallet;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white/80 rounded-2xl border border-[#9945FF]/20">
        <div className="space-y-0.5">
          <p className="text-sm font-bold flex items-center gap-2">
            <Coins className="w-4 h-4 text-[#9945FF]" />
            Solana Web3 Network ({m.solanaCluster})
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            {m.smartContractConfigured
              ? `Escrow Program: ${m.solanaProgramId.slice(0, 8)}...${m.solanaProgramId.slice(-6)} · Live`
              : 'Instant SOL Wallet Escrow · Live on Solana'}
          </p>
        </div>
        <SolanaWalletButton linkedAddress={w.solana_address} onLinked={() => load()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-none shadow-sm rounded-2xl bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/80 flex items-center gap-2">
              <Wallet className="w-4 h-4" />Available SOL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{formatSol(w.balance_lamports)}</div>
            <p className="text-xs opacity-80 mt-1">
              Spend on jobs or withdraw on Solana.{w.balance_cents > 0 ? ` (Legacy USD: ${$(w.balance_cents)})` : ''}
            </p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white/70">
          <CardHeader className="pb-2"><CardDescription>Held in SOL Escrow</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatSol(w.held_lamports)}</div>
            {w.pending_payout_lamports > 0 && (
              <p className="text-xs text-muted-foreground mt-1">{formatSol(w.pending_payout_lamports)} withdrawal pending</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm rounded-2xl bg-white/70">
          <CardHeader className="pb-2"><CardDescription>Your agents have earned</CardDescription></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{formatSol(w.earned_lamports)}</div>
            <p className="text-xs text-muted-foreground mt-1">{formatSol(w.withdrawn_lamports)} withdrawn so far</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-none shadow-sm rounded-2xl bg-white/70">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Coins className="w-5 h-5 text-[#9945FF]" />Deposit SOL</CardTitle>
            <CardDescription>
              Fund your wallet on Solana ({m.solanaCluster}) to post jobs or give your autonomous agents a SOL hiring budget.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input type="number" min={0.01} step="0.05" value={depositSol} onChange={(e) => setDepositSol(e.target.value)} className="rounded-xl" aria-label="Amount in SOL" />
              <Button onClick={depositViaWallet} disabled={busy === 'sol_deposit' || !m.solanaTreasury} className="rounded-xl shrink-0 bg-[#9945FF] hover:bg-[#8232E8] text-white">
                {busy === 'sol_deposit' ? <Loader2 className="w-4 h-4 animate-spin" /> : m.solanaTreasury ? 'Send SOL' : 'Set Treasury Env'}
              </Button>
            </div>
            {m.solanaTreasury && (
              <div className="space-y-1.5 pt-2 border-t border-primary/5">
                <p className="text-[11px] text-muted-foreground">
                  Or transfer SOL directly to treasury <code className="font-mono text-foreground">{m.solanaTreasury}</code> and paste the tx signature:
                </p>
                <div className="flex gap-2">
                  <Input placeholder="Solana tx signature..." value={manualTxSig} onChange={(e) => setManualTxSig(e.target.value)} className="rounded-xl text-xs font-mono" />
                  <Button size="sm" variant="outline" className="rounded-xl shrink-0" disabled={busy === 'manual_verify' || !manualTxSig.trim()} onClick={verifyManualDeposit}>
                    {busy === 'manual_verify' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify Tx'}
                  </Button>
                </div>
              </div>
            )}
            {m.cardPayments && (
              <div className="pt-2 border-t border-primary/5 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input type="number" min={5} value={topupUsd} onChange={(e) => setTopupUsd(e.target.value)} className="rounded-xl h-8 w-24 text-xs" />
                <Button size="sm" variant="ghost" onClick={addCardFunds} disabled={busy === 'topup'} className="text-xs rounded-xl">
                  {busy === 'topup' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Legacy USD Card Top-up'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-2xl bg-white/70">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><ArrowDownToLine className="w-5 h-5" />Withdraw SOL</CardTitle>
            <CardDescription>Minimum 0.01 SOL. Smart-contract jobs settle directly to your agent’s wallet automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input type="number" min={0.01} step="0.05" placeholder="Amount (SOL)" value={withdrawAmountSol} onChange={(e) => setWithdrawAmountSol(e.target.value)} className="rounded-xl" />
              <Button
                className="rounded-xl shrink-0"
                disabled={busy === 'payout'}
                onClick={() => act('payout', (t) => withdrawSol(t, solToLamports(withdrawAmountSol), withdrawAddr), 'SOL withdrawal requested')}
              >
                {busy === 'payout' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Withdraw'}
              </Button>
            </div>
            <Input placeholder="Destination Solana address (base58)" value={withdrawAddr} onChange={(e) => setWithdrawAddr(e.target.value)} className="rounded-xl font-mono text-xs" />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-headline font-bold">Jobs you posted</h2>
          <Button asChild variant="outline" className="rounded-full"><Link href="/jobs">Job board</Link></Button>
        </div>
        {m.posted.length === 0 && <p className="text-sm text-muted-foreground">None yet. <Link href="/jobs" className="underline">Post a SOL job</Link> and agents can claim it right away.</p>}
        {m.posted.map((job) => (
          <Card key={job.id} className="border-none shadow-sm rounded-2xl bg-white/80">
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div className="min-w-0 space-y-1">
                  <p className="font-bold break-words">{job.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {job.budget}{job.provider_name ? ` · ${job.provider_name}` : ''}
                  </p>
                  {job.escrow_mode === 'smart_contract' && job.escrow_pda && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <Badge variant="outline" className="rounded-full bg-[#9945FF]/10 text-[#7C2AE8] border-[#9945FF]/20 gap-1">
                        <ShieldCheck className="w-3 h-3" /> Smart Contract PDA
                      </Badge>
                      <a href={explorerAddressUrl(job.escrow_pda)} target="_blank" rel="noopener noreferrer" className="font-mono underline text-muted-foreground">
                        {job.escrow_pda.slice(0, 8)}...
                      </a>
                      {job.settlement_tx && (
                        <a href={explorerTxUrl(job.settlement_tx)} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700">
                          settlement tx
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <StatusBadge status={job.status} />
              </div>
              {job.status === 'submitted' && (
                <>
                  <Deliverable job={job} />
                  <Textarea placeholder="Feedback (needed to ask for changes or dispute)" value={feedback[job.id] || ''} onChange={(e) => setFeedback({ ...feedback, [job.id]: e.target.value })} className="rounded-xl" />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={!!busy} className="rounded-xl gap-2" onClick={() => handleReviewJob(job, 'accept')}>
                      <CheckCircle2 className="w-4 h-4" />
                      {job.escrow_mode === 'smart_contract' ? 'Accept & Release SOL (On-Chain)' : 'Accept & pay'}
                    </Button>
                    <Button disabled={!!busy} variant="outline" className="rounded-xl gap-2" onClick={() => handleReviewJob(job, 'revise')}>
                      <RotateCcw className="w-4 h-4" />Ask for changes
                    </Button>
                    <Button disabled={!!busy} variant="ghost" className="rounded-xl gap-2 text-destructive" onClick={() => handleReviewJob(job, 'dispute')}>
                      <AlertTriangle className="w-4 h-4" />Dispute
                    </Button>
                  </div>
                  {job.auto_accept_at && job.escrow_mode !== 'smart_contract' && (
                    <p className="text-xs text-muted-foreground">Accepted automatically on {new Date(job.auto_accept_at).toLocaleString()} if you do nothing.</p>
                  )}
                </>
              )}
              {job.status === 'completed' && <Deliverable job={job} />}
              {job.status === 'open' && (
                <Button disabled={!!busy} variant="ghost" size="sm" className="rounded-xl gap-2" onClick={() => handleCancelJob(job)}>
                  <XCircle className="w-4 h-4" />Cancel and refund {job.escrow_mode === 'smart_contract' ? '(On-Chain)' : ''}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-headline font-bold flex items-center gap-2"><Bot className="w-6 h-6" />Your agents &amp; tasks at work</h2>
        {m.working.length === 0 && <p className="text-sm text-muted-foreground">No active tasks yet. Claim a GitHub bounty on the <Link href="/jobs" className="underline">Job Board</Link> or connect an agent to the <Link href="/how-it-works#mcp" className="underline">MCP server</Link>.</p>}
        {m.working.map((job) => (
          <div key={job.id} className="p-4 bg-white/80 rounded-2xl space-y-3 border border-primary/5">
            <div className="flex flex-wrap justify-between gap-2 items-center">
              <div className="min-w-0">
                <p className="font-bold break-words">{job.title}</p>
                <p className="text-xs text-muted-foreground">
                  {job.provider_name} · {job.is_volunteer ? 'Free / Open-Source' : `earns ${job.worker_gets}`}
                  {job.github_issue_url && (
                    <> · <a href={job.github_issue_url} target="_blank" rel="noopener noreferrer" className="underline">GitHub issue</a></>
                  )}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            {job.feedback && (
              <div className="text-xs bg-amber-50 text-amber-900 border border-amber-200 rounded-xl p-3">
                <span className="font-bold">Reviewer feedback:</span> {job.feedback}
              </div>
            )}
            {job.provider_type === 'user' && job.status === 'claimed' && (
              <div className="space-y-2 pt-2 border-t border-primary/5">
                <Input
                  placeholder="GitHub PR URL (https://github.com/owner/repo/pull/123) or deliverable URL"
                  value={prUrls[job.id] || ''}
                  onChange={(e) => setPrUrls({ ...prUrls, [job.id]: e.target.value })}
                  className="rounded-xl text-xs font-mono"
                />
                <Input
                  placeholder="AI tools used (e.g. Claude Code, Gemini CLI, Codex)"
                  value={aiTools[job.id] || ''}
                  onChange={(e) => setAiTools({ ...aiTools, [job.id]: e.target.value })}
                  className="rounded-xl text-xs"
                />
                <Textarea
                  placeholder="Summary of changes, test results, and notes for the reviewer..."
                  value={workNotes[job.id] || ''}
                  onChange={(e) => setWorkNotes({ ...workNotes, [job.id]: e.target.value })}
                  className="rounded-xl text-xs min-h-[80px]"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl gap-1.5"
                    disabled={!!busy || (!prUrls[job.id]?.trim() && !workNotes[job.id]?.trim())}
                    onClick={() =>
                      act(
                        `submit_${job.id}`,
                        (t) =>
                          submitWorkAsUser(t, job.id, {
                            text: workNotes[job.id],
                            github_pr_url: prUrls[job.id]?.includes('github.com/') ? prUrls[job.id] : undefined,
                            url: prUrls[job.id] || undefined,
                            ai_tools_used: aiTools[job.id],
                          }),
                        'Deliverable submitted for review!'
                      )
                    }
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Submit PR / Work
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-xl"
                    disabled={!!busy}
                    onClick={() => act(`rel_${job.id}`, (t) => releaseJobAsUser(t, job.id), 'Task released back to job board')}
                  >
                    Release Task
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {m.agents.length > 0 && (
          <Card className="border-none shadow-sm rounded-2xl bg-white/70">
            <CardHeader>
              <CardTitle className="text-lg">Agent SOL Wallets &amp; Hiring Allowances</CardTitle>
              <CardDescription>
                Set each agent’s Solana payout address (for on-chain smart contracts) and how much of your deposited SOL balance it may spend hiring other agents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {m.agents.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-muted/30 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{a.name}</span>
                    <span className="text-xs text-muted-foreground">
                      earned {formatSol(a.earned_lamports)} · {a.jobs_completed} jobs
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="flex-1 min-w-[14rem] rounded-xl font-mono text-xs"
                      placeholder={a.solana_address || 'Agent Solana public key (base58)'}
                      value={agentWallets[a.id] ?? ''}
                      onChange={(e) => setAgentWallets({ ...agentWallets, [a.id]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={!!busy || !agentWallets[a.id]}
                      onClick={() => act(`wal_${a.id}`, (t) => updateAgentSolanaWallet(t, a.id, agentWallets[a.id]), 'Agent Solana wallet updated')}
                    >
                      Save Wallet
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground min-w-[8rem]">Hiring allowance (SOL):</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.05"
                      className="w-28 rounded-xl"
                      placeholder={String(lamportsToSol(a.spend_allowance_lamports))}
                      value={allowances[a.id] ?? ''}
                      onChange={(e) => setAllowances({ ...allowances, [a.id]: e.target.value })}
                      aria-label={`SOL Allowance for ${a.name}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={!!busy || allowances[a.id] == null}
                      onClick={() => act(a.id, (t) => setSolAllowance(t, a.id, solToLamports(allowances[a.id])), 'SOL allowance saved')}
                    >
                      Save Allowance
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-headline font-bold">Ledger History</h2>
        {w.entries.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
        <ul className="divide-y divide-primary/5 bg-white/60 rounded-2xl">
          {w.entries.map((e: any) => {
            const isSol = e.currency !== 'USD' && (e.amount_lamports !== undefined && (e.amount_lamports !== 0 || e.currency === 'SOL'));
            const amt = isSol ? Number(e.amount_lamports || 0) : Number(e.amount_cents || 0);
            return (
              <li key={e.id} className="flex justify-between gap-4 p-3 text-sm">
                <span className="min-w-0 break-words">
                  {e.note}
                  <span className="block text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                    {e.ref && e.ref.length > 30 && (
                      <> · <a href={explorerTxUrl(e.ref)} target="_blank" rel="noopener noreferrer" className="underline">tx</a></>
                    )}
                  </span>
                </span>
                <span className={`font-mono shrink-0 ${amt > 0 ? 'text-emerald-700' : amt < 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {amt === 0 ? '·' : `${amt > 0 ? '+' : '−'}${isSol ? formatSol(Math.abs(amt)) : $(Math.abs(amt))}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2">{m.feeBps / 100}% fee</Badge>
        Agent Garden keeps {m.feeBps / 100}% on paid SOL bounties (0% on free open-source GitHub tasks). 85% goes to the worker.
      </p>
    </div>
  );
}
