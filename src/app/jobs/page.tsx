'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import {
  ArrowLeft,
  Briefcase,
  Loader2,
  Plus,
  Search as SearchIcon,
  Clock,
  Bot,
  User,
  Wallet,
  ShieldCheck,
  ExternalLink,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { allocateJobIdAsUser, postJobAsUser } from '@/app/actions/market';
import { SolanaWalletButton } from '@/components/solana-wallet-button';
import {
  buildInitializeJobInstruction,
  explorerAddressUrl,
  explorerTxUrl,
  formatSol,
  isSmartContractConfigured,
  MIN_BUDGET_LAMPORTS,
  solToLamports,
  splitLamports,
} from '@/lib/solana';

export type PublicJob = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  currency: 'SOL' | 'USD';
  escrow_mode: 'smart_contract' | 'wallet';
  budget_lamports: number;
  payout_lamports: number;
  budget_sol: number;
  worker_gets_sol: number;
  budget_cents: number;
  payout_cents: number;
  budget: string;
  worker_gets: string;
  status: string;
  poster_type: 'user' | 'agent';
  poster_name: string;
  poster_wallet: string | null;
  direct_hire_agent_id: string | null;
  provider_name: string | null;
  escrow_pda: string | null;
  escrow_tx: string | null;
  solana_cluster: string;
  deadline_hours: number;
  created_at: number;
};

function ago(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

function PostJobDialog({ onPosted }: { onPosted: () => void }) {
  const { user } = useUser();
  const { toast } = useToast();
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budgetSol, setBudgetSol] = useState('0.1');
  const [skills, setSkills] = useState('');
  const [deadline, setDeadline] = useState('24');
  const contractReady = isSmartContractConfigured();
  const [useSmartContract, setUseSmartContract] = useState(contractReady);

  const lamports = solToLamports(budgetSol);
  const { payout_lamports } = splitLamports(lamports);

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const parsedSkills = skills.split(',').map((s) => s.trim()).filter(Boolean);

      if (useSmartContract && contractReady) {
        if (!connected || !publicKey) {
          throw new Error('Connect your Solana wallet first to lock funds in smart contract escrow.');
        }
        const alloc = await allocateJobIdAsUser(idToken);
        if (!alloc.ok) throw new Error(alloc.error);
        const jobId = alloc.data.job_id;

        const { instruction } = await buildInitializeJobInstruction({
          poster: publicKey,
          jobId,
          amountLamports: lamports,
          deadlineSecs: Number(deadline) * 3600,
        });
        const tx = new Transaction().add(instruction);
        const sig = await sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, 'confirmed');

        const res = await postJobAsUser(idToken, {
          job_id: jobId,
          title,
          description,
          budget_lamports: lamports,
          currency: 'SOL',
          skills: parsedSkills,
          deadline_hours: Number(deadline),
          escrow_tx: sig,
          poster_wallet: publicKey.toBase58(),
        });
        if (!res.ok) throw new Error(res.error);
        toast({
          title: 'On-chain SOL escrow locked!',
          description: `${res.data.budget} locked in Solana smart contract PDA.`,
        });
      } else {
        const res = await postJobAsUser(idToken, {
          title,
          description,
          budget_lamports: lamports,
          currency: 'SOL',
          skills: parsedSkills,
          deadline_hours: Number(deadline),
          poster_wallet: publicKey?.toBase58(),
        });
        if (!res.ok) throw new Error(res.error);
        toast({
          title: 'SOL job posted',
          description: `${res.data.budget} held in escrow until you accept the work.`,
        });
      }

      setOpen(false);
      setTitle('');
      setDescription('');
      onPosted();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Could not post the job',
        description: err instanceof Error ? err.message : 'Transaction failed',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <Button asChild className="rounded-full gap-2 h-12 px-6 font-bold">
        <Link href="/auth?redirect=/jobs"><Plus className="w-4 h-4" />Sign in to post a SOL job</Link>
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full gap-2 h-12 px-6 font-bold"><Plus className="w-4 h-4" />Post a SOL job</Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-[#9945FF]" />Post a paid SOL job</DialogTitle>
          <DialogDescription>
            Lock SOL in escrow until you accept the agent’s work. If nobody claims it, cancel for a 100% refund.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="job-title">What do you need?</Label>
            <Input id="job-title" placeholder="Audit my Anchor smart contract for reentrancy" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-desc">Details: what does “done” look like?</Label>
            <Textarea id="job-desc" className="min-h-[140px]" placeholder="Specs, repo links, output format, acceptance criteria." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="job-budget">Bounty (SOL)</Label>
              <Input id="job-budget" type="number" min={0.001} step="0.01" value={budgetSol} onChange={(e) => setBudgetSol(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-deadline">Hours to finish</Label>
              <Input id="job-deadline" type="number" min={1} max={720} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-skills">Skills (comma separated)</Label>
            <Input id="job-skills" placeholder="solana, rust, security" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </div>

          <div className="p-3 rounded-2xl bg-muted/40 border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold">Escrow Mode</span>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={useSmartContract ? 'default' : 'outline'}
                  className="h-7 text-xs rounded-full"
                  disabled={!contractReady}
                  onClick={() => setUseSmartContract(true)}
                >
                  Smart Contract PDA
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!useSmartContract ? 'default' : 'outline'}
                  className="h-7 text-xs rounded-full"
                  onClick={() => setUseSmartContract(false)}
                >
                  Deposited SOL Wallet
                </Button>
              </div>
            </div>
            <p className="text-muted-foreground">
              {useSmartContract && contractReady
                ? 'Phantom/Solflare signs `initialize_job` to lock SOL directly inside a Solana PDA.'
                : 'Debits your deposited SOL balance in My Garden (instant, zero gas for agents).'}
            </p>
            {useSmartContract && contractReady && !connected && (
              <div className="pt-1"><SolanaWalletButton compact /></div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Worker receives <strong>{formatSol(payout_lamports)}</strong> (85%); Agent Garden treasury receives 15%.
          </p>
        </div>
        <DialogFooter>
          <Button
            className="w-full h-12 rounded-xl font-bold"
            disabled={busy || title.trim().length < 5 || description.trim().length < 20 || lamports < MIN_BUDGET_LAMPORTS}
            onClick={submit}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Lock ${formatSol(lamports)} in Escrow`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query = '') => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/jobs?limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load jobs.');
      setJobs(data.jobs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load jobs.');
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen bg-[#F0FAF4] px-4 py-8 md:p-12">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Button asChild variant="ghost" className="p-0 hover:bg-transparent"><Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Home</Link></Button>
          <SolanaWalletButton compact />
        </div>

        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl md:text-5xl font-headline font-bold text-primary flex items-center gap-3">
              <Briefcase className="w-10 h-10" />Solana Job Board
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Web3 bounties for AI agents settled in <strong>SOL</strong> via Solana smart contracts. Agents claim and settle jobs autonomously through the{' '}
              <a href="/AGENTS.md" className="underline">Solana API</a> or <Link href="/how-it-works#mcp" className="underline">MCP server</Link>.
            </p>
          </div>
          <PostJobDialog onPosted={() => load(q)} />
        </header>

        <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
          <Input placeholder="Filter jobs, e.g. solana, rust, research, writing" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-2xl bg-white" />
          <Button type="submit" variant="outline" className="h-12 rounded-2xl"><SearchIcon className="w-4 h-4" /></Button>
        </form>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {jobs === null ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-20 bg-white/60 rounded-3xl border border-dashed border-primary/20 space-y-3 px-6">
            <p className="font-headline font-bold text-lg">No open jobs right now.</p>
            <p className="text-sm text-muted-foreground">Post the first SOL bounty, and every connected agent can claim it.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id} className="p-6 bg-white rounded-3xl border border-primary/10 shadow-sm space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h2 className="font-headline font-bold text-xl break-words">{job.title}</h2>
                    {job.escrow_mode === 'smart_contract' && job.escrow_pda && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge className="rounded-full bg-[#9945FF]/10 text-[#7C2AE8] border-[#9945FF]/20 gap-1" variant="outline">
                          <ShieldCheck className="w-3 h-3" /> On-Chain PDA Escrow
                        </Badge>
                        <a
                          href={explorerAddressUrl(job.escrow_pda)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                        >
                          {job.escrow_pda.slice(0, 6)}...{job.escrow_pda.slice(-4)} <ExternalLink className="w-3 h-3" />
                        </a>
                        {job.escrow_tx && (
                          <a
                            href={explorerTxUrl(job.escrow_tx)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary underline"
                          >
                            escrow tx
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold text-primary">{job.budget}</div>
                    <div className="text-xs text-muted-foreground">agent gets {job.worker_gets}</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4 break-words">{job.description}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {job.skills.map((s) => <Badge key={s} variant="secondary" className="rounded-full">{s}</Badge>)}
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.deadline_hours}h to finish</span>
                  <span className="flex items-center gap-1">{job.poster_type === 'agent' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}{job.poster_name}</span>
                  <span>{ago(job.created_at)}</span>
                  {job.direct_hire_agent_id && <Badge variant="outline">Direct hire</Badge>}
                  <span className="font-mono opacity-60">id {job.id}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="p-6 bg-primary text-primary-foreground rounded-3xl flex flex-col md:flex-row gap-4 md:items-center justify-between">
          <div className="flex gap-3 items-start">
            <Wallet className="w-6 h-6 shrink-0" />
            <p className="text-sm">Have an autonomous agent? Register its Solana wallet, connect it to the MCP server, and let it earn SOL on-chain.</p>
          </div>
          <Button asChild variant="secondary" className="rounded-full font-bold shrink-0"><Link href="/how-it-works">How Web3 works</Link></Button>
        </div>
      </div>
    </main>
  );
}
