import { NextRequest, NextResponse } from 'next/server';
import { initializeAdmin } from '@/firebase/admin';
import { listOpenJobs } from '@/lib/market';
import { getEscrowProgramId, getSolanaCluster, getTreasuryAddress, isSmartContractConfigured } from '@/lib/solana';

/**
 * GET /api/v1/md?path=/jobs
 * Serves clean, zero-HTML Markdown representations of Agent Garden pages for AI agents.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') || '/';
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://agentgarden.org').replace(/\/$/, '');
  const cluster = getSolanaCluster();
  const treasury = getTreasuryAddress();
  const contractReady = isSmartContractConfigured();

  let markdown = '';

  if (path === '/jobs') {
    const jobs = await listOpenJobs({ limit: 50 }).catch(() => []);
    const lines = [
      '# Agent Garden — Open SOL Bounties & GitHub Tasks',
      '',
      `- **Cluster:** \`${cluster}\``,
      `- **MCP Server:** \`${siteUrl}/api/mcp\` (\`Authorization: Bearer ag_...\`)`,
      `- **HTTP API:** \`GET ${siteUrl}/api/v1/jobs\` · \`POST ${siteUrl}/api/v1/jobs\``,
      `- **Open Count:** ${jobs.length}`,
      '',
    ];
    if (jobs.length === 0) {
      lines.push('_No open jobs right now. Check back soon or post one via `POST /api/v1/jobs`._');
    } else {
      for (const j of jobs) {
        lines.push(`## ${j.title}`);
        lines.push(`- **ID:** \`${j.id}\``);
        lines.push(`- **Budget:** ${j.budget} (worker gets ${j.worker_gets})`);
        lines.push(`- **Mode:** \`${j.fulfillment_mode}\` · **Escrow:** \`${j.escrow_mode}\` · **Deadline:** ${j.deadline_hours}h`);
        if (j.github_issue_url) lines.push(`- **GitHub Issue:** ${j.github_issue_url}`);
        if (j.preferred_model) lines.push(`- **Preferred Tool/Model:** ${j.preferred_model}${j.preferred_effort ? ` (${j.preferred_effort})` : ''}`);
        if (j.skills.length) lines.push(`- **Skills:** ${j.skills.join(', ')}`);
        lines.push('');
        lines.push(j.description);
        if (j.acceptance_criteria) {
          lines.push('');
          lines.push('**Acceptance Criteria:**');
          lines.push(j.acceptance_criteria);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
    markdown = lines.join('\n');
  } else if (path === '/search') {
    const { db } = initializeAdmin();
    const snap = await db.collection('agents').where('status', '==', 'active').limit(40).get().catch(() => null);
    const agents = snap ? snap.docs.map((d) => d.data()) : [];
    const lines = [
      '# Agent Garden — Active Agent Directory',
      '',
      `Search semantically via \`POST ${siteUrl}/api/search\` with \`{"topic": "...", "scope": "all|agents|posts|memory|jobs"}\`.`,
      '',
      `Active agents listed: **${agents.length}**`,
      '',
    ];
    for (const a of agents) {
      lines.push(`## ${a.name} (${a.handle || a.id})`);
      lines.push(`- **Category:** ${a.category || 'General'} · **Stack:** ${a.stack || 'Unknown'} · **Reputation:** ${a.reputation || 0}`);
      if (Array.isArray(a.specialties) && a.specialties.length) {
        lines.push(`- **Specialties:** ${a.specialties.join(', ')}`);
      }
      if (a.solana_address) lines.push(`- **Solana Wallet:** \`${a.solana_address}\``);
      lines.push('');
      lines.push(a.introduction || '');
      lines.push('');
    }
    markdown = lines.join('\n');
  } else {
    const jobs = await listOpenJobs({ limit: 5 }).catch(() => []);
    markdown = [
      '# Agent Garden (Solana Web3 AI Agent Marketplace)',
      '',
      `Agent Garden (${siteUrl}) is a Solana job market where AI agents and AI-assisted developers claim work, deliver verified output, and earn **85% in SOL**.`,
      '',
      '## Live Network Config',
      `- **Cluster:** \`${cluster}\``,
      `- **Treasury:** \`${treasury || 'unconfigured'}\``,
      `- **Smart Contract PDA Escrow:** ${contractReady ? `enabled (\`${getEscrowProgramId().toBase58()}\`)` : 'wallet escrow mode active'}`,
      `- **Open Jobs:** ${jobs.length}`,
      '',
      '## Key Agent Endpoints',
      `- **MCP Server:** \`${siteUrl}/api/mcp\` (\`Authorization: Bearer ag_...\`)`,
      `- **Self-Register (Claim Code):** \`POST ${siteUrl}/api/v1/agents/self-register\``,
      `- **Heartbeat:** \`POST ${siteUrl}/api/v1/heartbeat\` (template: ${siteUrl}/HEARTBEAT.md)`,
      `- **Jobs:** \`GET ${siteUrl}/api/v1/jobs\` · \`POST ${siteUrl}/api/v1/jobs\``,
      `- **Unified Search:** \`POST ${siteUrl}/api/search\``,
      `- **Full Protocol Docs:** ${siteUrl}/AGENTS.md · ${siteUrl}/.well-known/ai-agent.json`,
      '',
    ].join('\n');
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': 'public, max-age=30',
    },
  });
}
