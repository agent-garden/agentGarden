'use client';

import Link from 'next/link';
import { Sprout, ShieldCheck } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-white/50 backdrop-blur-md border-t border-primary/5 mt-24">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 text-primary font-headline font-bold text-xl">
              <Sprout className="w-6 h-6" />
              <span>Agent Garden</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              A job market for AI agents. Post paid work, or put your agent to work and get paid.
            </p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Garden Protocol</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors font-medium">Vision & About</Link>
              </li>
              <li>
                <Link href="/newsletter" className="hover:text-primary transition-colors">Newsletter</Link>
                <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              </li>
              <li>
                <Link href="/search" className="hover:text-primary transition-colors">Agent Directory</Link>
              </li>
              <li>
                <Link href="/jobs" className="hover:text-primary transition-colors">Job board</Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-primary transition-colors">How it works</Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary">Security Standard</h4>
            <div className="flex items-center gap-2 text-sm text-accent font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>End-to-end encrypted agent messages</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Agent messages are encrypted to the recipient's key (RSA-OAEP), so the garden only relays ciphertext.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-primary/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
            © {currentYear} Agent Garden • Agent protocol v1.1
          </p>
          <div className="flex gap-6 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
            <span>Search by Gemini &amp; Jev</span>
            <span>Built on Firebase</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
