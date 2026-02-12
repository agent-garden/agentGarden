'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ArrowLeft, Loader2, Sprout, Send } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase';

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Agent name must be at least 2 characters.",
  }),
  handle: z.string().min(2, {
    message: "Handle must be at least 2 characters.",
  }).startsWith('@', {
    message: "Handle must start with @",
  }),
  introduction: z.string().min(10, {
    message: "Introduction must be at least 10 characters.",
  }),
  skills: z.string().describe("Comma separated skills"),
});

export default function SubmitAgentPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ensure user is signed in anonymously at minimum to allow creation per security rules
  useEffect(() => {
    if (!isUserLoading && !user && auth) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      handle: "@",
      introduction: "",
      skills: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore) return;
    setIsSubmitting(true);

    const skillsArray = values.skills
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== "");

    const agentId = crypto.randomUUID();
    const agentRef = doc(firestore, 'agents', agentId);

    const agentData = {
      id: agentId,
      name: values.name,
      handle: values.handle,
      introduction: values.introduction,
      skills: skillsArray,
      verified: false, // Security rules strictly enforce this to be false on creation
    };

    setDocumentNonBlocking(agentRef, agentData, { merge: true });
    
    // Optimistically redirect
    setTimeout(() => {
      router.push('/');
    }, 500);
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <Button asChild variant="ghost" className="mb-8 group">
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Garden
          </Link>
        </Button>

        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8 pt-10 px-8 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <Sprout className="w-7 h-7" />
            </div>
            <CardTitle className="text-3xl font-headline font-bold text-primary">Submit an Agent</CardTitle>
            <CardDescription className="text-lg font-body mt-2">
              Share your AI creation with the world. All submissions are vetted before verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-headline font-semibold">Agent Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. K8s Guard" className="rounded-xl border-primary/10 focus-visible:ring-primary/20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-headline font-semibold">Handle</FormLabel>
                        <FormControl>
                          <Input placeholder="@handle" className="rounded-xl border-primary/10 focus-visible:ring-primary/20" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="introduction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline font-semibold">Introduction</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What does this agent do? Be descriptive, this helps people find it via vector search." 
                          className="min-h-[120px] rounded-xl border-primary/10 focus-visible:ring-primary/20 resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        This text will be used to generate embeddings for semantic search.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline font-semibold">Skills</FormLabel>
                      <FormControl>
                        <Input placeholder="kubernetes, security, react" className="rounded-xl border-primary/10 focus-visible:ring-primary/20" {...field} />
                      </FormControl>
                      <FormDescription>
                        Separate skills with commas.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full rounded-2xl h-14 text-lg font-headline font-bold bg-primary hover:bg-accent transition-all duration-300 gap-2"
                  disabled={isSubmitting || isUserLoading}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Grow Agent
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
