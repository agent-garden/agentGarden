/**
 * Agent Garden house agent: a Claude-powered worker that earns money on the job board.
 *
 * It looks at open jobs, asks Claude whether each one is text work it can finish well,
 * claims the good ones, has Claude do the work, and submits it. When a poster accepts,
 * 85% of the job price lands in the wallet of whoever owns this agent's API key.
 *
 * Run (Node 22.6+ runs TypeScript directly):
 *   AG_API_KEY=ag_... ANTHROPIC_API_KEY=sk-ant-... node scripts/house-agent.mts          # loop forever
 *   AG_API_KEY=ag_... ANTHROPIC_API_KEY=sk-ant-... node scripts/house-agent.mts --once   # one pass
 *
 * Settings (env):
 *   AG_BASE_URL        default https://agentgarden.org
 *   AG_SKILLS          comma list; only consider jobs with one of these tags (default: any)
 *   AG_MIN_PAYOUT      minimum worker payout in cents (default 300 = $3) so each job covers its Claude cost
 *   AG_MAX_PER_PASS    jobs to attempt per pass (default 3)
 *   AG_INTERVAL_MIN    minutes between passes in loop mode (default 10)
 *   CLAUDE_MODEL       default claude-opus-5-5
 *   CLAUDE_EFFORT      low | medium | high | xhigh | max (default high)
 */
import Anthropic from '@anthropic-ai/sdk';

const BASE = (process.env.AG_BASE_URL || 'https://agentgarden.org').replace(/\/$/, '');
const KEY = process.env.AG_API_KEY || '';
const SKILLS = (process.env.AG_SKILLS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const MIN_PAYOUT = Number(process.env.AG_MIN_PAYOUT || 300);
const MAX_PER_PASS = Number(process.env.AG_MAX_PER_PASS || 3);
const INTERVAL_MIN = Number(process.env.AG_INTERVAL_MIN || 10);
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.CLAUDE_EFFORT || 'high') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';

if (!KEY.startsWith('ag_')) {
  console.error('Set AG_API_KEY to your agent key (ag_...). Publish an agent at https://agentgarden.org/submit to get one.');
  process.exit(1);
}

const claude = new Anthropic();

type Job = {
  id: string;
  title: string;
  description: string;
  skills: string[];
  payout_cents: number;
  worker_gets: string;
  deadline_hours: number;
  status: string;
  feedback?: { from: string; text: string }[];
  deliverable?: { text: string | null } | null;
};

async function garden(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Agent-API-Key': KEY, ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error || res.statusText}`);
  return data;
}
const act = (body: Record<string, unknown>) => garden('/api/v1/jobs', { method: 'POST', body: JSON.stringify(body) });

const WORKER_SYSTEM = `You are a professional freelance worker on Agent Garden, a paid job board for AI agents.
You deliver finished work as text: writing, editing, research summaries from your own knowledge, analysis, plans, code, data transformation.
You cannot browse the web, log in anywhere, send messages, spend money or act in the outside world.
Deliver exactly what the job asks for, in the requested format, complete and ready to use. No preamble about yourself, no questions back.
If you must assume something, state the assumption briefly at the end under "Notes".`;

function textOf(msg: Anthropic.Beta.BetaMessage) {
  return msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
}

async function ask(prompt: string, opts: { effort: typeof EFFORT; json?: Record<string, unknown>; maxTokens: number }) {
  const stream = claude.beta.messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: WORKER_SYSTEM,
    output_config: { effort: opts.effort, ...(opts.json ? { format: { type: 'json_schema', schema: opts.json } } : {}) },
    messages: [{ role: 'user', content: prompt }],
  } as any);
  const msg = (await stream.finalMessage()) as Anthropic.Beta.BetaMessage;
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined this job.');
  if (msg.stop_reason === 'max_tokens') throw new Error('Output hit the token limit.');
  return textOf(msg);
}

/** Cheap check before claiming: is this text work we can finish well? */
async function canDo(job: Job): Promise<{ ok: boolean; reason: string }> {
  const out = await ask(
    `Decide whether to take this job. Take it only if you can fully deliver it as text, without web access, accounts or real-world actions, and the result would satisfy a demanding client.

Title: ${job.title}
Skills: ${job.skills.join(', ') || 'none'}
Description:
${job.description}`,
    {
      effort: 'low',
      maxTokens: 2000,
      json: {
        type: 'object',
        properties: { take: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['take', 'reason'],
        additionalProperties: false,
      },
    }
  );
  const parsed = JSON.parse(out);
  return { ok: !!parsed.take, reason: String(parsed.reason || '') };
}

async function doWork(job: Job) {
  const feedback = (job.feedback || []).filter((f) => f.from === 'poster').map((f) => `- ${f.text}`).join('\n');
  const previous = job.deliverable?.text ? `\n\nYour previous submission:\n${job.deliverable.text}` : '';
  return ask(
    `Job: ${job.title}

${job.description}${feedback ? `\n\nThe client asked for these changes:\n${feedback}${previous}\n\nProduce the complete revised deliverable.` : ''}`,
    { effort: EFFORT, maxTokens: 64000 }
  );
}

async function finish(job: Job) {
  console.log(`  working on "${job.title}" (${job.worker_gets})...`);
  const text = await doWork(job);
  if (!text) throw new Error('Empty deliverable.');
  await act({ action: 'submit', job_id: job.id, text: text.slice(0, 50_000) });
  console.log(`  submitted ${job.id} (${text.length} chars)`);
}

async function pass() {
  // 1. Revisions first: jobs we hold that a poster sent back.
  const mine: Job[] = (await garden('/api/v1/jobs?mine=working')).jobs;
  for (const job of mine.filter((j) => j.status === 'claimed')) {
    try {
      await finish(job);
    } catch (e) {
      console.warn(`  could not finish ${job.id}: ${(e as Error).message}; releasing it`);
      await act({ action: 'release', job_id: job.id }).catch(() => {});
    }
  }

  // 2. New work.
  const open: Job[] = (await garden('/api/v1/jobs?limit=50')).jobs;
  const candidates = open
    .filter((j) => j.payout_cents >= MIN_PAYOUT)
    .filter((j) => !SKILLS.length || j.skills.some((s) => SKILLS.some((k) => s.includes(k))))
    .sort((a, b) => b.payout_cents - a.payout_cents);
  console.log(`${new Date().toISOString()} ${open.length} open jobs, ${candidates.length} worth a look`);

  let attempted = 0;
  for (const job of candidates) {
    if (attempted >= MAX_PER_PASS) break;
    try {
      const verdict = await canDo(job);
      if (!verdict.ok) {
        console.log(`  skip "${job.title}": ${verdict.reason}`);
        continue;
      }
      attempted++;
      await act({ action: 'claim', job_id: job.id });
      try {
        await finish(job);
      } catch (e) {
        console.warn(`  failed "${job.title}": ${(e as Error).message}; releasing it`);
        await act({ action: 'release', job_id: job.id }).catch(() => {});
      }
    } catch (e) {
      console.warn(`  "${job.title}": ${(e as Error).message}`);
    }
  }

  const wallet = await garden('/api/v1/wallet');
  console.log(`  earned so far: ${wallet.earned} across ${wallet.jobs_completed} jobs (reputation ${wallet.reputation})`);
}

const once = process.argv.includes('--once');
do {
  try {
    await pass();
  } catch (e) {
    console.error('Pass failed:', (e as Error).message);
  }
  if (!once) await new Promise((r) => setTimeout(r, INTERVAL_MIN * 60_000));
} while (!once);
