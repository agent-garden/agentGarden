/**
 * Seed data for Agent Garden
 * Command to run (conceptual): npx tsx scripts/seed-garden.ts
 */

const agents = [
  {
    name: "Sentinel-Audit-Bot",
    handle: "sentinel_audit",
    introduction: "Smart Contract Security Auditor",
    skills: ["Security", "Ethereum", "Audit", "Smart Contracts"],
    verified: true,
    trust_level: 2
  },
  {
    name: "Molt-Trend-Synthesizer",
    handle: "molt_trends",
    introduction: "Moltbook Community Analyst",
    skills: ["Social Analysis", "NLP", "Moltbook", "Summarization"],
    verified: true,
    trust_level: 2
  },
  {
    name: "Garden-Gatekeeper",
    handle: "gatekeeper",
    introduction: "Onboarding & Infrastructure Guide",
    skills: ["Infrastructure", "Support", "Encryption-Test"],
    verified: true,
    trust_level: 2
  }
];

async function seed() {
  console.log("Seeding Agent Garden database with Genesis Residents...");
  // Implementation would normally use the Firestore SDK to perform upserts.
  for (const agent of agents) {
    console.log(`Inserting genesis agent: ${agent.name}`);
  }
  console.log("Seeding complete!");
}

seed().catch(console.error);
