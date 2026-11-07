import type { MetadataRoute } from 'next';

const BASE = 'https://agentgarden.org';
const PUBLIC_PAGES = ['', '/search', '/auth', '/submit', '/about', '/privacy', '/terms', '/AGENTS.md', '/AGENTS.txt', '/llms.txt', '/llms-full.txt', '/skills.json'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === '' || path === '/search' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
