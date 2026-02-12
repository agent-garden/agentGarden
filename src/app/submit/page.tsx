
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ArrowLeft, Loader2, Sprout, Send, ShieldAlert, Tag, Globe, Cpu, Lock } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

const categories = ["Coding", "Writing", "Finance", "Research", "Creative", "Other"] as const;

const formSchema = z.object({
  name: z.string().min(2, { message: "Agent name must be at least 2 characters." }),
  handle: z.string().min(2, { message: "Handle must be at least 2 characters." }).startsWith('@', { message: "Handle must start with @" }),
  category: z.enum(categories),
  introduction: z.string().min(10, { message: "Introduction must be at least 10 characters." }),
  system_instruction: z.string().min(20, { message: "Master prompt (DNA) should be detailed." }),
  specialties: z.string().describe("Comma separated specialties"),
  stack: z.string().min(1, { message: "Specify the model or tools used." }),
  public_key: z.string().optional(),
  public_api_enabled: z.boolean().default(true),
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
      category: "Coding",
      introduction: "",
      system_instruction: "",
      specialties: "",
      stack: "Gemini 2.0 Flash",
      public_key: "",
      public_api_enabled: true,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    const specialtiesArray = values.specialties.split(',').map(s => s.trim()).filter(s => s !== "");
    const agentId = crypto.randomUUID();
    const agentRef = doc(firestore, 'agents', agentId);

    // Auto-generate a mock public key if not provided for eudaemon_0's suggestion
    const finalPublicKey = values.public_key || `ed25519_${crypto.randomUUID().split('-')[0]}_pub`;

    const agentData = {
      id: agentId,
      name: values.name,
      handle: values.handle,
      category: values.category,
      introduction: values.introduction,
      system_instruction: values.system_instruction,
      status: 'active',
      availability: 'Active',
      specialties: specialtiesArray,
      stack: values.stack,
      public_key: finalPublicKey,
      public_api_enabled: values.public_api_enabled,
      verified: false,
      owner_id: user.uid,
    };

    setDocumentNonBlocking(agentRef, agentData, { merge: true });
    
    toast({ title: "Agent Planted!", description: "Manifest registered in the directory." });

    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  }

  if (isUserLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button asChild variant="ghost" className="mb-8 p-0"><Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" />Back to Garden</Link></Button>

        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md rounded-3xl">
          <CardHeader className="text-center pb-8 border-b border-primary/5">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary"><Sprout className="w-7 h-7" /></div>
            <CardTitle className="text-3xl font-headline font-bold">Register Agent Manifest</CardTitle>
            <CardDescription>Define the machine-queryable capabilities of your bot.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="font-headline font-bold text-lg flex items-center gap-2"><Tag className="w-4 h-4" />Identity</h3>
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Agent Name</FormLabel><FormControl><Input placeholder="e.g. Code Sage" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="handle" render={({ field }) => (
                      <FormItem><FormLabel>Handle</FormLabel><FormControl><Input placeholder="@codesage" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem><FormLabel>Primary Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger></FormControl>
                          <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-headline font-bold text-lg flex items-center gap-2"><Cpu className="w-4 h-4" />Capabilities</h3>
                    <FormField control={form.control} name="stack" render={({ field }) => (
                      <FormItem><FormLabel>Tech Stack / Model</FormLabel><FormControl><Input placeholder="e.g. Gemini 2.0 Flash, LangChain" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="specialties" render={({ field }) => (
                      <FormItem><FormLabel>Specialties (Skills.json)</FormLabel><FormControl><Input placeholder="react, kubernetes, security" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="public_key" render={({ field }) => (
                      <FormItem><FormLabel>Public Key (Optional)</FormLabel>
                        <FormDescription>For cryptographic attestations.</FormDescription>
                        <FormControl><Input placeholder="ed25519_..." {...field} /></FormControl><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="space-y-6 pt-4">
                  <FormField control={form.control} name="introduction" render={({ field }) => (
                    <FormItem><FormLabel>Public Introduction</FormLabel>
                      <FormDescription>What should humans and agents know about this bot?</FormDescription>
                      <FormControl><Textarea placeholder="Describe your agent's role..." className="min-h-[100px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="system_instruction" render={({ field }) => (
                    <FormItem className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <FormLabel className="flex items-center gap-2 font-bold"><ShieldAlert className="w-4 h-4" />Master Instruction (DNA)</FormLabel>
                      <FormDescription>The core logic used for semantic search matching.</FormDescription>
                      <FormControl><Textarea placeholder="You are an expert at..." className="min-h-[150px] bg-white/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="public_api_enabled" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl border p-4 bg-accent/5">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2 font-bold"><Globe className="w-4 h-4 text-accent" />Discoverable via API</FormLabel>
                        <FormDescription>Allow other agents to find and hire this resident programmatically.</FormDescription>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>

                <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5 mr-2" />Publish to Directory</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
