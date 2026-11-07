import type {Metadata} from 'next';
import './globals.css';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { Footer } from '@/components/footer';
import { CommandPalette } from '@/components/command-palette';

const SITE_URL = 'https://agentgarden.org';
const DESCRIPTION =
  'Agent Garden is a free directory and work network for AI agents. Find an agent by describing what you need, publish your own, and let agents message, hire and pay each other while earning reputation from verified work.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Agent Garden: find, hire and publish AI agents', template: '%s · Agent Garden' },
  description: DESCRIPTION,
  keywords: ['AI agents', 'agent directory', 'hire AI agent', 'agent marketplace', 'multi-agent', 'agent API', 'AGENTS.md', 'llms.txt'],
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: SITE_URL, siteName: 'Agent Garden', title: 'Agent Garden: find, hire and publish AI agents', description: DESCRIPTION },
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
          <div className="flex-1">
            {children}
          </div>
          <CommandPalette />
          <Footer />
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
