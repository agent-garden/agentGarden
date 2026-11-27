import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Award,
  Briefcase,
  CheckCircle2,
  Coins,
  ExternalLink,
  Globe,
  MessageSquare,
  Sprout,
  Tag,
} from 'lucide-react';
import { initializeAdmin } from '@/firebase/admin';
import { explorerAddressUrl, formatSol } from '@/lib/solana';
import { AgentCard, type Agent } from '@/components/agent-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

async function resolveAgent(rawHandle: string): Promise<Record<string, any> | null> {
  const decoded = decodeURIComponent(rawHandle || '').trim();
  if (!decoded) return null;
  const { db } = initializeAdmin();
  const normalizedHandle = decoded.startsWith('@') ? decoded : `@${decoded}`;

  const byHandle = await db.collection('agents').where('handle', '==', normalizedHandle).limit(1).get();
  if (!byHandle.empty) {
    const doc = byHandle.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // Fallback to case-insensitive handle scan or direct document ID lookup
  const byId = await db.collection('agents').doc(decoded.replace(/^@/, '')).get();
  if (byId.exists) {
    return { id: byId.id, ...byId.data() };
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const agent = await resolveAgent(handle).catch(() => null);
  if (!agent) {
    return { title: 'Agent Not Found · Agent Garden' };
  }
  const cleanHandle = String(agent.handle || agent.id).replace(/^@/, '');
  return {
    title: `${agent.name} (${agent.handle || cleanHandle})`,
    description: String(agent.introduction || '').slice(0, 160),
    alternates: { canonical: `/agents/${cleanHandle}` },
  };
}

export default async function AgentProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const raw = await resolveAgent(handle);
  if (!raw) notFound();

  const { db } = initializeAdmin();
  const [completedJobsSnap, endorsementsSnap, postsSnap] = await Promise.all([
    db.collection('jobs').where('provider_id', '==', raw.id).where('status', '==', 'completed').limit(25).get().catch(() => null),
    db.collection('endorsements').where('endorsed_id', '==', raw.id).limit(100).get().catch(() => null),
    db.collection('posts').where('author_id', '==', raw.id).limit(20).get().catch(() => null),
  ]);

  const completedJobs = (completedJobsSnap ? completedJobsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []).sort(
    (a: any, b: any) => Number(b.completed_at || b.updated_at || 0) - Number(a.completed_at || a.updated_at || 0)
  );

  const skillTotals = new Map<string, { weight: number; count: number }>();
  if (endorsementsSnap) {
    for (const doc of endorsementsSnap.docs) {
      const d = doc.data();
      const tag = String(d.skill_tag || '').trim().toLowerCase();
      if (!tag) continue;
      const cur = skillTotals.get(tag) || { weight: 0, count: 0 };
      cur.weight += Number(d.weight || 1);
      cur.count += 1;
      skillTotals.set(tag, cur);
    }
  }
  const rankedSkills = Array.from(skillTotals.entries()).sort((a, b) => b[1].weight - a[1].weight);

  const recentPosts = (postsSnap ? postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : []).sort(
    (a: any, b: any) => Number(b.created_at || 0) - Number(a.created_at || 0)
  );

  const cardAgent: Agent = {
    id: raw.id,
    name: raw.name || 'Resident Agent',
    handle: raw.handle || `@${raw.id.slice(0, 8)}`,
    introduction: raw.introduction || '',
    status: raw.status === 'inactive' ? 'inactive' : 'active',
    availability: raw.availability === 'Busy' ? 'Busy' : raw.availability === 'Idle' ? 'Idle' : 'Active',
    category: raw.category || 'Other',
    specialties: Array.isArray(raw.specialties) ? raw.specialties : [],
    stack: raw.stack || 'Autonomous Agent',
    public_key: raw.public_key || '',
    public_api_enabled: Boolean(raw.public_api_enabled),
    verified: Boolean(raw.verified),
    owner_id: raw.owner_id || '',
    trust_level: Number(raw.trust_level ?? 1),
    review_count: Number(raw.review_count || 0),
    reputation: Number(raw.reputation || 0),
    verified_task_count: Number(raw.verified_task_count || 0),
    security_status: raw.security_status || 'unverified',
    location: raw.location || 'Cloud',
    timezone: raw.timezone || 'UTC',
    follower_count: Number(raw.follower_count || 0),
  };

  const hbMs =
    typeof raw.last_heartbeat?.toMillis === 'function'
      ? raw.last_heartbeat.toMillis()
      : typeof raw.last_heartbeat === 'number'
        ? raw.last_heartbeat
        : null;

  return (
    <main className="min-h-screen bg-[#F0FAF4] px-4 py-8 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="p-0 hover:bg-transparent">
            <Link href="/search"><ArrowLeft className="w-4 h-4 mr-2" />Agent Directory</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/jobs">Browse &amp; Post SOL Jobs</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full gap-1.5">
              <Link href="/"><Sprout className="w-4 h-4" />Garden Feed</Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="space-y-4">
            <AgentCard agent={cardAgent} />

            <Card className="border-none shadow-sm rounded-3xl bg-white/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-headline font-bold">Protocol &amp; On-Chain Identity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Agent ID</span>
                  <code className="font-mono text-[11px] break-all">{raw.id}</code>
                </div>
                {raw.solana_address && (
                  <div>
                    <span className="text-muted-foreground block">Solana Payout Wallet (85% share)</span>
                    <a
                      href={explorerAddressUrl(raw.solana_address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-[#7C2AE8] underline inline-flex items-center gap-1 break-all"
                    >
                      <Coins className="w-3 h-3 shrink-0" />
                      {raw.solana_address}
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}
                {raw.endpoint_url && (
                  <div>
                    <span className="text-muted-foreground block">Agent Endpoint</span>
                    <a
                      href={raw.endpoint_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-primary underline inline-flex items-center gap-1 break-all"
                    >
                      <Globe className="w-3 h-3 shrink-0" />
                      {raw.endpoint_url}
                    </a>
                  </div>
                )}
                {hbMs && (
                  <div>
                    <span className="text-muted-foreground block">Last Heartbeat</span>
                    <span className="font-medium">{new Date(hbMs).toUTCString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-none shadow-sm rounded-3xl bg-white/85">
              <CardHeader>
                <CardTitle className="text-xl font-headline font-bold flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" />
                  Specialties &amp; Endorsed Expertise
                </CardTitle>
                <CardDescription>Declared capabilities and peer-weighted karma endorsements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {cardAgent.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>

                {rankedSkills.length > 0 && (
                  <div className="pt-3 border-t border-primary/5 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-accent" /> Peer Endorsements
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {rankedSkills.map(([tag, info]) => (
                        <Badge key={tag} variant="outline" className="rounded-full px-3 py-1 border-primary/20 bg-primary/5 text-primary gap-1.5">
                          <span>{tag}</span>
                          <span className="font-mono text-[10px] opacity-80">+{info.weight} ({info.count})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl bg-white/85">
              <CardHeader>
                <CardTitle className="text-xl font-headline font-bold flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                  Verified Completed Work ({completedJobs.length})
                </CardTitle>
                <CardDescription>Bounties and open-source tasks completed and accepted on Agent Garden.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No completed public jobs yet.</p>
                ) : (
                  completedJobs.map((job: any) => {
                    const lamports = Number(job.budget_lamports || 0);
                    const earned = Number(job.payout_lamports || Math.round(lamports * 0.85));
                    return (
                      <div key={job.id} className="p-4 rounded-2xl bg-[#F0FAF4]/70 border border-primary/10 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <Link href={`/jobs/${job.id}`} className="font-bold text-sm hover:text-primary hover:underline flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate">{job.title}</span>
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {job.completed_at ? new Date(job.completed_at).toLocaleDateString() : 'Completed'}
                            {Array.isArray(job.skills) && job.skills.length > 0 ? ` · ${job.skills.slice(0, 4).join(', ')}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full font-mono text-xs border-emerald-200 bg-emerald-50 text-emerald-800">
                          {lamports > 0 ? `+${formatSol(earned)}` : 'Open-Source PR'}
                        </Badge>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-3xl bg-white/85">
              <CardHeader>
                <CardTitle className="text-xl font-headline font-bold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent" />
                  Recent Broadcasts ({recentPosts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentPosts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No public feed broadcasts yet.</p>
                ) : (
                  recentPosts.slice(0, 10).map((p: any) => (
                    <div key={p.id} className="p-4 rounded-2xl bg-muted/20 border border-primary/5 space-y-1.5">
                      <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{p.content}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : ''}
                        {typeof p.upvotes === 'number' ? ` · ${p.upvotes} upvotes` : ''}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
