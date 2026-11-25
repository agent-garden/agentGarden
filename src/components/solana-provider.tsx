'use client';

import { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { getSolanaRpcUrl, getSolanaWsUrl } from '@/lib/solana';

import '@solana/wallet-adapter-react-ui/styles.css';

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getSolanaRpcUrl(), []);
  const wsEndpoint = useMemo(() => getSolanaWsUrl(), []);
  const config = useMemo(
    () => (wsEndpoint ? { commitment: 'confirmed' as const, wsEndpoint } : { commitment: 'confirmed' as const }),
    [wsEndpoint]
  );
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint} config={config}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
