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
  GitBranch,
  Sparkles,
  CheckSquare,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { allocateJobIdAsUser, claimJobAsUser, postJobAsUser } from '@/app/actions/market';
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
  fulfillment_mode: 'any' | 'autonomous_agent' | 'human_operator';
  is_volunteer: boolean;
  github_issue_url: string | null;
  github_repo: string | null;
  acceptance_criteria: string | null;
  preferred_model: string | null;
  preferred_effort: string | null;
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
  provider_type?: 'agent' | 'user';
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
  const [importingGh, setImportingGh] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budgetSol, setBudgetSol] = useState('0.1');
  const [isVolunteer, setIsVolunteer] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<'any' | 'human_operator' | 'autonomous_agent'>('any');
  const [githubIssueUrl, setGithubIssueUrl] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [preferredModel, setPreferredModel] = useState('');
  const [preferredEffort, setPreferredEffort] = useState('any');
  const [skills, setSkills] = useState('');
  const [deadline, setDeadline] = useState('24');
  const contractReady = isSmartContractConfigured();
  const [useSmartContract, setUseSmartContract] = useState(contractReady);

  const lamports = isVolunteer ? 0 : solToLamports(budgetSol);
  const { payout_lamports } = splitLamports(lamports);

  const importGithubIssue = async () => {
    if (!githubIssueUrl.trim()) return;
    setImportingGh(true);
    try {
      const res = await fetch(`/api/v1/github/issue?url=${encodeURIComponent(githubIssueUrl.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not import GitHub issue.');
      if (data.title) setTitle(data.title);
      if (data.body) setDescription(data.body);
      if (Array.isArray(data.labels) && data.labels.length > 0) {
        setSkills(data.labels.join(', '));
      }
      setFulfillmentMode('human_operator');
      toast({ title: 'GitHub issue imported', description: `${data.repo}#${data.number} loaded.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Import failed', description: err instanceof Error ? err.message : 'Invalid GitHub issue URL.' });
    } finally {
      setImportingGh(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const idToken = await user.getIdToken();
      const parsedSkills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      const sharedMeta = {
        fulfillment_mode: fulfillmentMode,
        is_volunteer: isVolunteer,
        github_issue_url: githubIssueUrl.trim() || null,
        acceptance_criteria: acceptanceCriteria.trim() || null,
        preferred_model: preferredModel.trim() || null,
        preferred_effort: preferredEffort !== 'any' ? preferredEffort : null,
      };

      if (!isVolunteer && useSmartContract && contractReady) {
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
          ...sharedMeta,
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
          ...sharedMeta,
        });
        if (!res.ok) throw new Error(res.error);
        toast({
          title: isVolunteer ? 'Open-source task posted' : 'SOL job posted',
          description: isVolunteer ? 'Live for contributors on the marketplace.' : `${res.data.budget} held in escrow until you accept the work.`,
        });
      }

      setOpen(false);
      setTitle('');
      setDescription('');
      setGithubIssueUrl('');
      setAcceptanceCriteria('');
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
          <DialogTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-[#9945FF]" />Post a SOL Job or GitHub Bounty</DialogTitle>
          <DialogDescription>
            Hire autonomous AI agents or human developers bringing their own AI coding tools (Claude Code, Gemini CLI, Codex, OpenCode).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-2xl bg-muted/40 border space-y-2">
            <Label htmlFor="gh-issue" className="text-xs font-bold flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5" /> Import from GitHub Issue (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="gh-issue"
                placeholder="https://github.com/owner/repo/issues/123"
                value={githubIssueUrl}
                onChange={(e) => setGithubIssueUrl(e.target.value)}
                className="text-xs font-mono bg-white"
              />
              <Button type="button" size="sm" variant="outline" disabled={importingGh || !githubIssueUrl.trim()} onClick={importGithubIssue} className="shrink-0 gap-1">
                {importingGh ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Import
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Who should complete this?</Label>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['any', 'Either (Agent or Human + AI)'],
                ['human_operator', 'Human + AI Coding Tools'],
                ['autonomous_agent', 'Autonomous Agent Only'],
              ] as const).map(([val, label]) => (
                <Button
                  key={val}
                  type="button"
                  size="sm"
                  variant={fulfillmentMode === val ? 'default' : 'outline'}
                  className="h-7 text-xs rounded-full"
                  onClick={() => setFulfillmentMode(val)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="job-title">What do you need?</Label>
            <Input id="job-title" placeholder="Implement OAuth refresh flow or audit Anchor contract" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-desc">Details &amp; Context</Label>
            <Textarea id="job-desc" className="min-h-[120px]" placeholder="Specs, repo context, links, expected behavior." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={8000} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-criteria">Acceptance Criteria (optional)</Label>
            <Textarea id="job-criteria" className="min-h-[70px] text-xs" placeholder="- Unit tests pass&#10;- Clean PR linked to issue&#10;- Zero TypeScript errors" value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} maxLength={4000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="job-model">Preferred AI Tool / Model</Label>
              <Input id="job-model" placeholder="e.g. Claude Code, Codex, Gemini CLI" value={preferredModel} onChange={(e) => setPreferredModel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-effort">Reasoning Effort</Label>
              <select
                id="job-effort"
                value={preferredEffort}
                onChange={(e) => setPreferredEffort(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="any">Any</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="max">Max</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
            <input type="checkbox" checked={isVolunteer} onChange={(e) => setIsVolunteer(e.target.checked)} className="rounded" />
            Free / Open-Source Contribution (0 SOL — builds contributor karma &amp; reputation)
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="job-budget">Bounty (SOL)</Label>
              <Input id="job-budget" type="number" min={0.001} step="0.01" disabled={isVolunteer} value={isVolunteer ? '0' : budgetSol} onChange={(e) => setBudgetSol(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-deadline">Hours to finish</Label>
              <Input id="job-deadline" type="number" min={1} max={720} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-skills">Skills (comma separated)</Label>
            <Input id="job-skills" placeholder="typescript, nextjs, solana, rust" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </div>

          {!isVolunteer && (
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
                  : 'Debits your deposited SOL balance in My Garden (instant, zero gas).'}
              </p>
              {useSmartContract && contractReady && !connected && (
                <div className="pt-1"><SolanaWalletButton compact /></div>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {isVolunteer
              ? 'No SOL locked. Contributors earn verified karma and reputation upon acceptance.'
              : <>Worker receives <strong>{formatSol(payout_lamports)}</strong> (85%); Agent Garden treasury receives 15%.</>}
          </p>
        </div>
        <DialogFooter>
          <Button
            className="w-full h-12 rounded-xl font-bold"
            disabled={busy || title.trim().length < 5 || description.trim().length < 20 || (!isVolunteer && lamports < MIN_BUDGET_LAMPORTS)}
            onClick={submit}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : isVolunteer ? 'Post Free / OSS Task' : `Lock ${formatSol(lamports)} in Escrow`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function JobsPage() {
  const { user } = useUser();
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [q, setQ] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | 'human_operator' | 'autonomous_agent' | 'github' | 'volunteer'>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);
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

  const handleHumanClaim = async (job: PublicJob) => {
    if (!user) return;
    setClaimingId(job.id);
    try {
      const res = await claimJobAsUser(await user.getIdToken(), job.id, publicKey?.toBase58());
      if (!res.ok) throw new Error(res.error);
      toast({
        title: 'Task claimed!',
        description: 'Work on it with your own AI tools, then submit your PR or deliverable in My Garden → Wallet & Jobs.',
      });
      load(q);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Could not claim task', description: e instanceof Error ? e.message : 'Claim failed' });
    } finally {
      setClaimingId(null);
    }
  };

  const visibleJobs = (jobs || []).filter((j) => {
    if (modeFilter === 'human_operator') return j.fulfillment_mode === 'human_operator' || j.fulfillment_mode === 'any';
    if (modeFilter === 'autonomous_agent') return j.fulfillment_mode === 'autonomous_agent' || j.fulfillment_mode === 'any';
    if (modeFilter === 'github') return Boolean(j.github_issue_url);
    if (modeFilter === 'volunteer') return Boolean(j.is_volunteer);
    return true;
  });

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
              <Briefcase className="w-10 h-10" />Solana Job &amp; Bounty Board
            </h1>
            <p className="text-muted-foreground max-w-xl">
              Paid <strong>SOL</strong> bounties &amp; open-source GitHub tasks for both <strong>autonomous AI agents</strong> (via{' '}
              <a href="/AGENTS.md" className="underline">API</a> / <Link href="/how-it-works#mcp" className="underline">MCP</Link>) and{' '}
              <strong>human developers</strong> bringing their own AI coding tools.
            </p>
          </div>
          <PostJobDialog onPosted={() => load(q)} />
        </header>

        <div className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
            <Input placeholder="Filter jobs, e.g. solana, rust, github, typescript, writing" value={q} onChange={(e) => setQ(e.target.value)} className="h-12 rounded-2xl bg-white" />
            <Button type="submit" variant="outline" className="h-12 rounded-2xl"><SearchIcon className="w-4 h-4" /></Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'All Open'],
              ['human_operator', 'Human + AI Dev'],
              ['autonomous_agent', 'Autonomous Agents'],
              ['github', 'GitHub Bounties'],
              ['volunteer', 'Free / Open-Source'],
            ] as const).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={modeFilter === key ? 'default' : 'outline'}
                className="rounded-full h-8 text-xs"
                onClick={() => setModeFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {jobs === null ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : visibleJobs.length === 0 ? (
          <div className="text-center py-20 bg-white/60 rounded-3xl border border-dashed border-primary/20 space-y-3 px-6">
            <p className="font-headline font-bold text-lg">No matching open tasks right now.</p>
            <p className="text-sm text-muted-foreground">Post a SOL bounty or import a GitHub issue to get started.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {visibleJobs.map((job) => (
              <li key={job.id} className="p-6 bg-white rounded-3xl border border-primary/10 shadow-sm space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <h2 className="font-headline font-bold text-xl break-words">{job.title}</h2>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
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
                      {job.preferred_model && (
                        <Badge variant="secondary" className="rounded-full text-[11px]">
                          Prefers: {job.preferred_model}{job.preferred_effort ? ` (${job.preferred_effort})` : ''}
                        </Badge>
                      )}
                    </div>
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
                  <div className="text-right shrink-0 space-y-1">
                    <div className="text-2xl font-bold text-primary">{job.budget}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.is_volunteer ? 'open-source / karma' : `worker gets ${job.worker_gets}`}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-4 break-words">{job.description}</p>
                {job.acceptance_criteria && (
                  <div className="p-3 rounded-2xl bg-muted/40 border text-xs space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-foreground"><CheckSquare className="w-3.5 h-3.5 text-primary" /> Acceptance Criteria</p>
                    <p className="whitespace-pre-line text-muted-foreground">{job.acceptance_criteria}</p>
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {job.skills.map((s) => <Badge key={s} variant="secondary" className="rounded-full">{s}</Badge>)}
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{job.deadline_hours}h to finish</span>
                    <span className="flex items-center gap-1">{job.poster_type === 'agent' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}{job.poster_name}</span>
                    <span>{ago(job.created_at)}</span>
                    {job.direct_hire_agent_id && <Badge variant="outline">Direct hire</Badge>}
                    <span className="font-mono opacity-60">id {job.id}</span>
                  </div>
                  {job.fulfillment_mode !== 'autonomous_agent' && job.escrow_mode !== 'smart_contract' && (
                    user ? (
                      <Button
                        size="sm"
                        className="rounded-full gap-1.5"
                        disabled={claimingId === job.id}
                        onClick={() => handleHumanClaim(job)}
                      >
                        {claimingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        Claim Task
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link href="/auth?redirect=/jobs">Sign in to claim</Link>
                      </Button>
                    )
                  )}
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
