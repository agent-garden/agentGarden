'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, ArrowLeft, ShieldAlert, Key, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { makeAdmin } from '@/actions/admin';
import { useToast } from '@/hooks/use-toast';

/**
 * Administrative Control Center
 * 
 * This route is strictly protected by checking the 'admin' custom claim 
 * on the user's Firebase ID Token.
 */
export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [hasAdminClaim, setHasAdminClaim] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function checkClaims() {
      if (user) {
        // Force refresh the token to get the latest custom claims
        const idTokenResult = await user.getIdTokenResult(true);
        setHasAdminClaim(!!idTokenResult.claims.admin);
      }
    }
    
    if (!isUserLoading) {
      if (!user) {
        router.push('/auth?redirect=/admin');
      } else {
        checkClaims();
      }
    }
  }, [user, isUserLoading, router]);

  const handlePromoteSelf = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await makeAdmin(user.uid);
      toast({
        title: "Role Registry Updated",
        description: "You have been added to the administrative database. Note: Real custom claims require a server-side refresh.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Promotion Failed",
        description: "Only existing gardeners can authorize new administrators."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading || hasAdminClaim === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // --- PROTECTED RENDER LOGIC ---
  // Only renders the UI if the 'admin' custom claim is detected
  if (!hasAdminClaim) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl bg-white/80 backdrop-blur-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 text-destructive">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold">Access Restricted</CardTitle>
            <CardDescription>
              Your token does not currently possess the 'admin' claim required for this protocol.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <Key className="h-4 w-4" />
              <AlertTitle className="text-xs uppercase tracking-widest font-bold">Token Verification Failed</AlertTitle>
              <AlertDescription className="text-xs">
                Firestore Security Rules and this UI both require the 'admin: true' custom claim.
              </AlertDescription>
            </Alert>
            <div className="pt-4 flex flex-col gap-2">
              <Button onClick={handlePromoteSelf} disabled={isProcessing} className="rounded-xl h-12 font-bold gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Promote to Admin (Simulated)
              </Button>
              <Button asChild variant="ghost" className="rounded-xl">
                <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Return to Garden</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12">
          <Button asChild variant="ghost" className="mb-4 group p-0 hover:bg-transparent">
            <Link href="/dashboard" className="flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
                <ShieldCheck className="w-10 h-10" />
                Admin Terminal
              </h1>
              <p className="text-muted-foreground mt-2">
                Verified: {user?.email} • Claim: Admin Active
              </p>
            </div>
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => window.location.reload()}>
              <RefreshCw className="w-4 h-4" />
              Sync Claims
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Registry Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-headline font-bold text-primary">Active</p>
              <p className="text-xs text-muted-foreground mt-1">Full override permissions enabled.</p>
            </CardContent>
          </Card>
          
          <Card className="md:col-span-2 border-none shadow-sm rounded-2xl bg-slate-900 text-white">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-400">System Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-[10px] font-mono leading-relaxed text-emerald-400">
                [SYSTEM] Custom Claim 'admin' verified for UID: {user?.uid}<br/>
                [PROTOCOL] Simulation oversight active...<br/>
                [DIRECTORY] All manifest DNA readable.
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
