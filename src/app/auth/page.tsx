
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Leaf, Loader2, Sparkles, Key } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { submitInviteRequest } from '@/app/actions/request-invite';

export default function AuthPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const redirectTo = searchParams.get('redirect') || '/dashboard';

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>, mode: 'login' | 'signup') => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const inviteCode = formData.get('inviteCode') as string;

    try {
      if (mode === 'signup') {
        if (!inviteCode) throw new Error('Invite code is required for Garden access.');

        // Verify invite code exists
        const inviteRef = doc(db, 'invite_codes', inviteCode.trim().toUpperCase());
        const inviteDoc = await getDoc(inviteRef);

        if (!inviteDoc.exists() || inviteDoc.data()?.uses_left <= 0) {
          throw new Error('Invalid or expired invite code.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: name });
        
        // Initialize user profile
        const userRef = doc(db, 'users', user.uid);
        setDocumentNonBlocking(userRef, {
          id: user.uid,
          email: user.email,
          displayName: name,
          monthly_invite_limit: 30,
          invites_remaining: 30,
          createdAt: new Date().toISOString()
        }, { merge: true });

        toast({
          title: "Welcome to the Garden!",
          description: "Your account is initialized with 30 monthly referral seeds.",
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast({ title: "Welcome back!", description: "Successfully logged in." });
      }
      router.push(redirectTo);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Authentication Error", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRequesting(true);
    const formData = new FormData(e.currentTarget);
    const res = await submitInviteRequest({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      intended_use: formData.get('intended_use') as string,
    });
    setRequesting(false);

    if (res.success) {
      toast({ title: "Request Submitted", description: "The Gardeners will review your credentials soon." });
      setShowRequestDialog(false);
    } else {
      toast({ variant: "destructive", title: "Submission Failed", description: res.error });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Link href="/" className="flex items-center gap-2 mb-8 group">
        <Leaf className="text-primary w-10 h-10 group-hover:rotate-12 transition-transform" />
        <h1 className="font-headline text-4xl text-primary tracking-tight">Agent Garden</h1>
      </Link>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/60 backdrop-blur-xl">
        <Tabs defaultValue="login" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2 rounded-full h-12 bg-muted/50 p-1">
              <TabsTrigger value="login" className="rounded-full">Login</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full">Sign Up</TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <TabsContent value="login">
            <form onSubmit={(e) => handleAuth(e, 'login')}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="you@example.com" required className="rounded-xl h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input name="password" type="password" required className="rounded-xl h-12" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full h-12 rounded-full text-lg font-headline" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sign In"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={(e) => handleAuth(e, 'signup')}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input name="name" type="text" placeholder="John Doe" required className="rounded-xl h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input name="email" type="email" placeholder="you@example.com" required className="rounded-xl h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input name="password" type="password" required className="rounded-xl h-12" />
                </div>
                <div className="space-y-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                  <div className="flex items-center justify-between mb-1">
                    <Label className="flex items-center gap-2">
                      <Key className="w-3 h-3 text-primary" />
                      Invite Code
                    </Label>
                    <button 
                      type="button" 
                      onClick={() => setShowRequestDialog(true)}
                      className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
                    >
                      Request Invite
                    </button>
                  </div>
                  <Input name="inviteCode" placeholder="GARDEN-XXXXX" required className="rounded-xl h-10 font-mono" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full h-12 rounded-full text-lg font-headline" disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Create Account"}
                </Button>
              </CardFooter>
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl text-primary">Request Garden Access</DialogTitle>
            <DialogDescription>Apply for a vetted seat in the autonomous infrastructure.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" required placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input name="email" type="email" required placeholder="jane@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Intended Use</Label>
              <Textarea name="intended_use" required placeholder="Briefly describe why you want to plant agents in the garden..." />
            </div>
            <Button type="submit" className="w-full h-12 rounded-full font-headline text-lg" disabled={requesting}>
              {requesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Submit Application
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
