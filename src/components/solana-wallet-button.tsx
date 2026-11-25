'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';
import { Wallet, CheckCircle2, Copy, LogOut, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { formatSol, getSolanaCluster } from '@/lib/solana';
import { linkSolanaWallet } from '@/app/actions/market';

export function SolanaWalletButton({
  linkedAddress,
  onLinked,
  compact = false,
}: {
  linkedAddress?: string | null;
  onLinked?: (address: string) => void;
  compact?: boolean;
}) {
  const { connection } = useConnection();
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const { user } = useUser();
  const { toast } = useToast();

  const [balanceLamports, setBalanceLamports] = useState<number | null>(null);
  const [linking, setLinking] = useState(false);

  const address = publicKey?.toBase58() || null;
  const cluster = getSolanaCluster();
  const isLinked = !!address && linkedAddress === address;

  const refreshBalance = useCallback(async () => {
    if (!publicKey) {
      setBalanceLamports(null);
      return;
    }
    try {
      const bal = await connection.getBalance(publicKey);
      setBalanceLamports(bal);
    } catch {
      setBalanceLamports(null);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  const handleLink = async () => {
    if (!user || !publicKey || !signMessage) {
      toast({
        variant: 'destructive',
        title: 'Cannot link wallet',
        description: 'Connect a wallet that supports message signing (e.g. Phantom, Solflare, Backpack).',
      });
      return;
    }
    setLinking(true);
    try {
      const msg = `Link Solana wallet ${publicKey.toBase58()} to Agent Garden account ${user.uid} at ${Date.now()}`;
      const sigBytes = await signMessage(new TextEncoder().encode(msg));
      const sigBase58 = bs58.encode(sigBytes);
      const res = await linkSolanaWallet(await user.getIdToken(), publicKey.toBase58(), msg, sigBase58);
      if (!res.ok) throw new Error(res.error);
      toast({ title: 'Solana wallet linked', description: `${publicKey.toBase58().slice(0, 6)}...${publicKey.toBase58().slice(-4)} verified.` });
      onLinked?.(res.data.solana_address);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Linking failed', description: err instanceof Error ? err.message : 'Rejected' });
    } finally {
      setLinking(false);
    }
  };

  if (!connected || !address) {
    return (
      <Button
        type="button"
        onClick={() => setVisible(true)}
        className="rounded-full gap-2 font-bold bg-[#9945FF] hover:bg-[#8232E8] text-white shadow-sm"
        size={compact ? 'sm' : 'default'}
      >
        <Wallet className="w-4 h-4" />
        Connect Solana Wallet
      </Button>
    );
  }

  const shortAddr = `${address.slice(0, 4)}...${address.slice(-4)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 border border-[#9945FF]/30 text-xs shadow-sm">
        <span className="w-2 h-2 rounded-full bg-[#14F195]" />
        <Badge variant="outline" className="text-[10px] uppercase px-1.5 py-0 border-[#9945FF]/40 text-[#7C2AE8]">
          {cluster}
        </Badge>
        <span className="font-mono font-bold text-foreground">{shortAddr}</span>
        {balanceLamports !== null && (
          <span className="font-mono text-muted-foreground">· {formatSol(balanceLamports)}</span>
        )}
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(address);
            toast({ title: 'Address copied' });
          }}
          className="text-muted-foreground hover:text-foreground"
          title="Copy Solana address"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => disconnect()}
          className="text-muted-foreground hover:text-destructive"
          title="Disconnect wallet"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>

      {user && !compact && (
        isLinked ? (
          <Badge variant="secondary" className="rounded-full gap-1 bg-emerald-100 text-emerald-800 border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Linked to profile
          </Badge>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={handleLink} disabled={linking} className="rounded-full gap-1.5 text-xs">
            {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
            Verify &amp; Link Wallet
          </Button>
        )
      )}
    </div>
  );
}
