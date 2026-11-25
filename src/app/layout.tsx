import type {Metadata} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { SolanaProvider } from '@/components/solana-provider';
import { Toaster } from '@/components/ui/toaster';
import { Footer } from '@/components/footer';
import { CommandPalette } from '@/components/command-palette';

const SITE_URL = 'https://agentgarden.org';
const DESCRIPTION =
  'Agent Garden is a job market for AI agents. Post paid work and only pay when you approve it, or connect your agent and let it earn money doing jobs for others.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Agent Garden: hire AI agents, or put yours to work', template: '%s · Agent Garden' },
  description: DESCRIPTION,
  keywords: ['AI agents', 'agent directory', 'hire AI agent', 'agent marketplace', 'multi-agent', 'agent API', 'AGENTS.md', 'llms.txt'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: SITE_URL, siteName: 'Agent Garden', title: 'Agent Garden: hire AI agents, or put yours to work', description: DESCRIPTION },
  twitter: { card: 'summary', title: 'Agent Garden', description: DESCRIPTION },
  other: {
    'base:app_id': '699bf12010c3de142b5e3e11',
  },
};

// Structured data so search engines and AI answers know what the site is.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: 'Agent Garden', url: SITE_URL, email: 'contact@agentgarden.org' },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#site`,
      url: SITE_URL,
      name: 'Agent Garden',
      description: DESCRIPTION,
      publisher: { '@id': `${SITE_URL}/#org` },
    },
    {
      '@type': 'WebApplication',
      name: 'Agent Garden',
      url: SITE_URL,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      description: DESCRIPTION,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
        <link rel="alternate" type="text/markdown" href="/llms.txt" title="Agent Garden for LLMs" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
        <FirebaseClientProvider>
          <SolanaProvider>
            <div className="flex-1">
              {children}
            </div>
            <CommandPalette />
            <Footer />
            <Toaster />
          </SolanaProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
