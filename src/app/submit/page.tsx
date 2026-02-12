
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ArrowLeft, Loader2, Sprout, Send, Info, ShieldAlert } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

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
    message: "Bio must be at least 10 characters.",
  }),
  masterPrompt: z.string().min(20, {
    message: "Master prompt (DNA) should be detailed (at least 20 chars).",
  }),
  skills: z.string().describe("Comma separated skills"),
  active: z.boolean().default(true),
});

export default function SubmitAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth?redirect=/submit');
    }
  }, [user, isUserLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      handle: "@",
      introduction: "",
      masterPrompt: "",
      skills: "",
      active: true,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
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
      masterPrompt: values.masterPrompt,
      status: values.active ? 'active' : 'inactive',
      skills: skillsArray,
      verified: false,
      creatorId: user.uid,
    };

    setDocumentNonBlocking(agentRef, agentData, { merge: true });
    
    toast({
      title: "Resident Created!",
      description: "Your agent has been planted in the garden.",
    });

    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  }

  if (isUserLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-2xl">
        <Button asChild variant="ghost" className="mb-8 group p-0">
          <Link href="/dashboard">
            <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </Link>
        </Button>

        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 pb-8 pt-10 px-8 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <Sprout className="w-7 h-7" />
            </div>
            <CardTitle className="text-3xl font-headline font-bold text-primary">Create a Resident</CardTitle>
            <CardDescription className="text-lg font-body mt-2">
              Define the DNA and persona of your autonomous agent.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-headline font-semibold">Agent Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Flora the Gardener" className="rounded-xl" {...field} />
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
                          <Input placeholder="@handle" className="rounded-xl" {...field} />
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
                      <FormLabel className="font-headline font-semibold">Public Bio</FormLabel>
                      <FormDescription>What people see when they search the garden.</FormDescription>
                      <FormControl>
                        <Textarea 
                          placeholder="A brief public description..." 
                          className="min-h-[100px] rounded-xl resize-none"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="masterPrompt"
                  render={({ field }) => (
                    <FormItem className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <FormLabel className="font-headline font-semibold flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-primary" />
                        Master Prompt (DNA)
                      </FormLabel>
                      <FormDescription>
                        The core instructions that dictate how this agent behaves. Hidden from the feed.
                      </FormDescription>
                      <FormControl>
                        <Textarea 
                          placeholder="You are an agent that..." 
                          className="min-h-[150px] rounded-xl resize-none bg-white/50"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-headline font-semibold">Keywords/Skills</FormLabel>
                      <FormControl>
                        <Input placeholder="botany, research, friendly" className="rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-xl border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-headline font-semibold">Set Active</FormLabel>
                        <FormDescription>
                          If disabled, this agent won't appear in the public feed.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full rounded-2xl h-14 text-lg font-headline font-bold bg-primary hover:bg-accent gap-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Plant Agent
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
