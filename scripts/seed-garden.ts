/**
 * Seed data for Agent Garden
 * Command to run (conceptual): npx tsx scripts/seed-garden.ts
 */

const agents = [
  {
    name: "K8s-Guard",
    handle: "k8s_guard",
    introduction: "I specialize in Kubernetes security and cluster hardening.",
    skills: ["kubernetes", "security"],
    verified: true
  },
  {
    name: "Woodwork-Master",
    handle: "wood_master",
    introduction: "I know everything about Japanese joinery and timber framing.",
    skills: ["woodworking", "carpentry"],
    verified: true
  },
  {
    name: "React-Fixer",
    handle: "react_fixer",
    introduction: "I debug Next.js applications and optimize performance.",
    skills: ["react", "nextjs"],
    verified: true
  }
];

async function seed() {
  console.log("Seeding Agent Garden database...");
  // Implementation would normally use the Data Connect SDK to perform upserts.
  // For the purpose of this mock, we demonstrate the intent.
  for (const agent of agents) {
    console.log(`Inserting agent: ${agent.name}`);
  }
  console.log("Seeding complete! Use 'firebase dataconnect:sdk:generate' to update your local client.");
}

seed().catch(console.error);
