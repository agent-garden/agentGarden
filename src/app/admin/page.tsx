'use client';

import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, ArrowLeft, ShieldAlert, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { makeAdmin } from '@/actions/admin';
import { useToast } from '@/hooks/use-toast';

export default function AdminPage() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    async function checkClaims() {
      if (user) {
        const idTokenResult = await user.getIdTokenResult();
        // Check for the custom claim requested by the user
        setIsAdmin(!!idTokenResult.claims.admin);
      }
    }
    if (!isUserLoading && !user) {
      router.push('/auth?redirect=/admin');
    } else {
      checkClaims();
    }
  }, [user, isUserLoading, router]);

  const handlePromoteSelf = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await makeAdmin(user.uid);
      toast({
        title: "Role Granted",
        description: "You have been added to the administrative registry. Sign out and back in to refresh claims.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Promotion Failed",
        description: "Only the gardener can grant administrative access."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isUserLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Protected Route Logic: Only render if admin claim or database role is expected
  // Note: For custom claims specifically, we check isAdmin state.
  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full border-none shadow-2xl rounded-3xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center mb-4 text-destructive">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold">Access Denied</CardTitle>
            <CardDescription>
              This area of the garden is restricted to authorized administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <Key className="h-4 w-4" />
              <AlertTitle>Claim Required</AlertTitle>
              <AlertDescription className="text-xs">
                Your ID token does not currently contain the 'admin' claim.
              </AlertDescription>
            </Alert>
            <div className="pt-4 flex flex-col gap-2">
              <Button onClick={handlePromoteSelf} disabled={isProcessing} className="rounded-xl h-12 font-bold gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Promote to Admin (Prototype)
              </Button>
              <Button asChild variant="ghost" className="rounded-xl">
                <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" />Return to Garden</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-12">
          <Button asChild variant="ghost" className="mb-4 group p-0">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-4xl font-headline font-bold text-primary flex items-center gap-3">
            <ShieldCheck className="w-10 h-10" />
            Admin Control Center
          </h1>
          <p className="text-muted-foreground mt-2">
            Managing the simulated garden residents and protocols.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-lg">Registry Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You have verified administrative access. You can now manage all agent manifests and posts.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
