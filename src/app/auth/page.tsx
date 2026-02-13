
'use client';

import { useState, useEffect } from 'react';
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
import { useAuth, useUser, useFirestore } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp } from '@/firebase/non-blocking-login';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { RequestInviteDialog } from '@/components/request-invite-dialog';

const authSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  inviteCode: z.string().optional(),
});

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  
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

  useEffect(() => {
    if (user && !isUserLoading) {
      router.push(redirect);
    }
  }, [user, isUserLoading, router, redirect]);

  useEffect(() => {
    if (urlCode) {
      form.setValue('inviteCode', urlCode);
      setActiveTab('signup');
    }
  }, [urlCode, form]);

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
    if (!values.inviteCode) {
      form.setError("inviteCode", { message: "Invite code is required for registration." });
      return;
    }

    setIsSubmitting(true);
    try {
      const inviteRef = doc(firestore, 'invite_codes', values.inviteCode);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        throw new Error("Invalid invite code. This code is not in the garden registry.");
      }

      const inviteData = inviteSnap.data();
      if (inviteData.uses_left <= 0) {
        throw new Error("This invite code has no uses left.");
      }

      const userCredential = await initiateEmailSignUp(auth, values.email, values.password);
      
      if (userCredential.user) {
        await setDoc(doc(firestore, 'users', userCredential.user.uid), {
          id: userCredential.user.uid,
          email: values.email,
          displayName: values.email.split('@')[0],
          monthly_invite_limit: 30,
          invites_remaining: 30,
          created_at: Date.now(),
          invite_code_used: values.inviteCode
        });
      }

      toast({ title: "Account Created!", description: "Welcome to the garden. Your 30 monthly invites are ready." });
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

  if (isUserLoading) {
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
            <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-8 rounded-xl">
                <TabsTrigger value="login" className="rounded-lg">Login</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg">Sign Up</TabsTrigger>
              </TabsList>

              <Form {...form}>
                <form className="space-y-4">
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
                        <FormLabel>Password</FormLabel>
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
                            Invite Code
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                placeholder="Enter your Golden Ticket" 
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
                            {urlCode ? "Invite code applied from link." : "Required for entry to the gardener registry."}
                            {!urlCode && (
                              <RequestInviteDialog 
                                trigger={
                                  <button type="button" className="text-primary hover:underline flex items-center gap-1">
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
                      type="button"
                      onClick={form.handleSubmit(onSignIn)}
                      className="w-full rounded-xl h-12 mt-4 font-headline font-bold gap-2"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      Log In
                    </Button>
                  </TabsContent>

                  <TabsContent value="signup">
                    <Button 
                      type="button"
                      onClick={form.handleSubmit(onSignUp)}
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
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
