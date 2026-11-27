'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, Sprout, LogIn, UserPlus, ArrowLeft, Ticket, HelpCircle, Lock } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth, useUser } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import { checkInviteCode, completeSignup, getProfileStatus } from '@/app/actions/onboarding';
import { GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail, signInWithPopup, signOut } from 'firebase/auth';
import { RequestInviteDialog } from '@/components/request-invite-dialog';

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  inviteCode: z.string().optional(),
});

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [needsInvite, setNeedsInvite] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(false);
  
  const redirect = searchParams.get('redirect') || '/';
  const urlCode = searchParams.get('code');

  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      inviteCode: urlCode || "",
    },
  });

  // After any sign-in, ask the server whether this account has a gardener profile.
  useEffect(() => {
    let cancelled = false;
    async function checkProfile() {
      if (!user || isUserLoading) return;
      setIsCheckingProfile(true);
      try {
        const status = await getProfileStatus(await user.getIdToken());
        if (cancelled) return;
        if (status.hasProfile) {
          if (status.isAdmin) await user.getIdToken(true); // pick up admin claim
          router.push(redirect);
        } else {
          setNeedsInvite(true);
          setActiveTab('signup');
        }
      } catch (error: any) {
        if (!cancelled) toast({ variant: "destructive", title: "Could not load your profile", description: error.message });
      } finally {
        if (!cancelled) setIsCheckingProfile(false);
      }
    }
    checkProfile();
    return () => { cancelled = true; };
  }, [user, isUserLoading, router, redirect, toast]);

  async function onGoogleSignIn() {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      toast({ title: "Signed in with Google", description: "Checking your gardener profile..." });
    } catch (error: any) {
      if (error?.code !== 'auth/popup-closed-by-user') {
        toast({ variant: "destructive", title: "Google sign-in failed", description: error.message });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onFinishJoining() {
    if (!user) return;
    const code = (form.getValues('inviteCode') || '').trim();
    setIsSubmitting(true);
    try {
      await completeSignup(await user.getIdToken(), code, false);
      toast({ title: "Welcome to the Garden", description: "Your 30 monthly invites are ready." });
      setNeedsInvite(false);
      router.push(redirect);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not finish joining", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (urlCode) {
      form.setValue('inviteCode', urlCode);
      setActiveTab('signup');
    }
  }, [urlCode, form]);

  async function onForgotPassword() {
    const email = (form.getValues('email') || '').trim();
    if (!email) {
      toast({ variant: "destructive", title: "Enter your email first", description: "Type your email address above and click Forgot password." });
      return;
    }
    setIsSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Password reset email sent", description: `Check ${email} for a reset link.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not send reset email", description: error.message || "Verify the email address and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSignIn(values: z.infer<typeof authSchema>) {
    setIsSubmitting(true);
    try {
      await initiateEmailSignIn(auth, values.email, values.password);
      toast({ title: "Welcome Back", description: "Synchronizing your gardener profile..." });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Authentication Failed", 
        description: error.message || "Please check your credentials." 
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSignUp(values: z.infer<typeof authSchema>) {
    setIsSubmitting(true);
    try {
      // Sign-up is open. An invite code is optional and only recorded if valid.
      const code = (values.inviteCode || '').trim();
      const userCredential = await initiateEmailSignUp(auth, values.email, values.password);
      await sendEmailVerification(userCredential.user).catch(() => {});
      const idToken = await userCredential.user.getIdToken();
      await completeSignup(idToken, code);

      toast({ title: "Account Created!", description: "Check your email for a verification link. You'll need it to publish an agent." });
      setNeedsInvite(false);
      router.push(redirect);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Signup Failed", 
        description: error.message || "Could not create account." 
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isUserLoading || (user && isCheckingProfile && !needsInvite)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <Button asChild variant="ghost" className="mb-8 group">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </Button>

        <Card className="border-none shadow-2xl bg-white/70 backdrop-blur-lg rounded-3xl overflow-hidden">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <Sprout className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold">Join the Garden</CardTitle>
            <CardDescription>Discover and share specialized AI agents.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            {user && needsInvite ? (
              <Form {...form}>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Signed in as <span className="font-semibold text-foreground">{user.email}</span>. Enter your invite code to finish joining the garden.
                  </p>
                  <FormField
                    control={form.control}
                    name="inviteCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-accent font-bold"><Ticket className="w-4 h-4" />Invite Code (optional)</FormLabel>
                        <FormControl><Input placeholder="Have an invite code? Enter it here" {...field} className="rounded-xl" /></FormControl>
                        <FormDescription className="text-[10px] flex items-center gap-2">
                          No code yet?
                          <RequestInviteDialog trigger={<button type="button" className="text-primary hover:underline text-[10px]">Request one</button>} />
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" onClick={onFinishJoining} className="w-full rounded-xl h-12 font-headline font-bold gap-2" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    Finish Joining
                  </Button>
                  <Button type="button" variant="ghost" className="w-full rounded-xl" onClick={() => { setNeedsInvite(false); signOut(auth); }}>
                    Use a different account
                  </Button>
                </div>
              </Form>
            ) : (
            <>
            <Button
              type="button"
              variant="outline"
              onClick={onGoogleSignIn}
              disabled={isSubmitting}
              className="w-full rounded-xl h-12 mb-6 font-headline font-bold gap-3 bg-white"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1C3.3 21.3 7.3 24 12 24z"/><path fill="#FBBC05" d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>
              Continue with Google
            </Button>
            <div className="relative mb-6 text-center text-xs uppercase text-muted-foreground">
              <span className="bg-white/70 px-2 relative z-10">or use email</span>
              <div className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-8 rounded-xl">
                <TabsTrigger value="login" className="rounded-lg">Login</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg">Sign Up</TabsTrigger>
              </TabsList>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(activeTab === 'login' ? onSignIn : onSignUp)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" {...field} className="rounded-xl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          {activeTab === 'login' && (
                            <button
                              type="button"
                              onClick={onForgotPassword}
                              className="text-xs text-primary hover:underline"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} className="rounded-xl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {activeTab === "signup" && (
                    <FormField
                      control={form.control}
                      name="inviteCode"
                      render={({ field }) => (
                        <FormItem className="pt-2">
                          <FormLabel className="flex items-center gap-2 text-accent font-bold">
                            <Ticket className="w-4 h-4" />
                            Invite Code (optional)
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="Have an invite code? Enter it here" 
                                {...field} 
                                className={`rounded-xl border-accent/20 focus:border-accent ${urlCode ? 'bg-muted pr-10' : ''}`}
                                readOnly={!!urlCode}
                              />
                              {urlCode && (
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </FormControl>
                          <FormDescription className="text-[10px] flex items-center gap-2">
                            {urlCode ? "Invite code applied from link." : "Optional. Sign-up is open to everyone."}
                            {!urlCode && (
                              <RequestInviteDialog 
                                trigger={
                                  <button type="button" className="text-primary hover:underline flex items-center gap-1 text-[10px]">
                                    <HelpCircle className="w-3 h-3" />
                                    Request one
                                  </button>
                                }
                              />
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <TabsContent value="login">
                    <Button 
                      type="submit"
                      className="w-full rounded-xl h-12 mt-4 font-headline font-bold gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      Log In
                    </Button>
                  </TabsContent>

                  <TabsContent value="signup">
                    <Button 
                      type="submit"
                      className="w-full rounded-xl h-12 mt-4 font-headline font-bold gap-2 bg-primary hover:bg-accent"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      Create Account
                    </Button>
                  </TabsContent>
                </form>
              </Form>
            </Tabs>
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
