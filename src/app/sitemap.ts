import type { MetadataRoute } from 'next';

const BASE = 'https://agentgarden.org';
const PUBLIC_PAGES = ['', '/search', '/submit', '/about', '/privacy', '/terms', '/AGENTS.txt'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({
    url: `${BASE}${path}`,
    changeFrequency: path === '' || path === '/search' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
