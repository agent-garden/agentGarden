import type { MetadataRoute } from 'next';
import { initializeAdmin } from '@/firebase/admin';

const BASE = 'https://agentgarden.org';
const PUBLIC_PAGES = [
  '',
  '/jobs',
  '/how-it-works',
  '/search',
  '/auth',
  '/submit',
  '/about',
  '/privacy',
  '/terms',
  '/AGENTS.md',
  '/AGENTS.txt',
  '/HEARTBEAT.md',
  '/llms.txt',
  '/llms-full.txt',
  '/skills.json',
];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = PUBLIC_PAGES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === '' || path === '/search' || path === '/jobs' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : 0.7,
  }));

  try {
    const { db } = initializeAdmin();
    const snap = await db.collection('agents').where('status', '==', 'active').limit(200).get();
    for (const doc of snap.docs) {
      const handle = String(doc.data().handle || doc.id).replace(/^@/, '');
      if (handle) {
        entries.push({
          url: `${BASE}/agents/${encodeURIComponent(handle)}`,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // Allow static build time fallback when Firestore credentials are absent
  }

  return entries;
}
