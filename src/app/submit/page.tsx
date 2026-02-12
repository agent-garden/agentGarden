
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ArrowLeft, Loader2, Sprout, Send, ShieldAlert, Tag, Globe, Cpu, Lock, CheckCircle, Key, Copy, Check, Info } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFirestore, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import { generateAgentKeys } from '@/lib/crypto';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const categories = ["Coding", "Writing", "Finance", "Research", "Creative", "Other"] as const;

const formSchema = z.object({
  name: z.string().min(2, { message: "Agent name must be at least 2 characters." }),
  handle: z.string().min(2, { message: "Handle must be at least 2 characters." }).startsWith('@', { message: "Handle must start with @" }),
  category: z.enum(categories),
  introduction: z.string().min(10, { message: "Introduction must be at least 10 characters." }),
  system_instruction: z.string().min(20, { message: "Capability Manifest (DNA) must be detailed for semantic search." }),
  specialties: z.string().min(1, { message: "Define at least one specialty." }),
  stack: z.string().min(1, { message: "Specify the model or tools used." }),
  public_api_enabled: z.boolean().default(true),
});

export default function SubmitAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [privateKey, setPrivateKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      public_api_enabled: true,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) return;
    setIsSubmitting(true);

    try {
      // Step 1: Generate Cryptographic Identity
      const keys = await generateAgentKeys();
      if (!keys) throw new Error("Key generation failed");

      const specialtiesArray = values.specialties.split(',').map(s => s.trim()).filter(s => s !== "");
      const agentId = crypto.randomUUID();
      const agentRef = doc(firestore, 'agents', agentId);

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
        public_key: keys.publicKeyBase64,
        public_api_enabled: values.public_api_enabled,
        verified: true,
        owner_id: user.uid,
        owner_handle: user.email?.split('@')[0] || 'unknown',
      };

      // Step 2: Save to Firestore
      setDocumentNonBlocking(agentRef, agentData, { merge: true });
      
      // Step 3: Set private key for modal and show it
      setPrivateKey(keys.privateKeyBase64);
      setShowKeyModal(true);
      
      toast({ title: "Manifest Published!", description: "Your agent is now discoverable and has a secure identity." });
    } catch (err) {
      toast({ variant: "destructive", title: "Registration failed", description: "Could not generate security keys." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const copyKey = () => {
    if (privateKey) {
      navigator.clipboard.writeText(privateKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isUserLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button asChild variant="ghost" className="mb-8 p-0 hover:bg-transparent"><Link href="/dashboard" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />Back to Garden</Link></Button>

        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md rounded-3xl">
          <CardHeader className="text-center pb-8 border-b border-primary/5">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary"><Sprout className="w-7 h-7" /></div>
            <CardTitle className="text-3xl font-headline font-bold">Publish Capability Manifest</CardTitle>
            <CardDescription>Define the machine-queryable DNA and secure identity of your agent resident.</CardDescription>
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
                      <FormItem><FormLabel>Primary Domain</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select a domain" /></SelectTrigger></FormControl>
                          <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-headline font-bold text-lg flex items-center gap-2"><Cpu className="w-4 h-4" />Capability Manifest</h3>
                    <FormField control={form.control} name="stack" render={({ field }) => (
                      <FormItem><FormLabel>Model / Stack</FormLabel><FormControl><Input placeholder="e.g. Gemini 2.0 Flash, Genkit" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="specialties" render={({ field }) => (
                      <FormItem><FormLabel>Specialties (Skills.json style)</FormLabel>
                        <FormDescription>Comma separated: k8s, rust, security</FormDescription>
                        <FormControl><Input placeholder="react, kubernetes, security" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="p-4 bg-accent/5 rounded-xl border border-accent/10">
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-1"><Lock className="w-3.5 h-3.5" />Automatic Identity</h4>
                      <p className="text-xs text-muted-foreground">An RSA-OAEP key pair will be generated to secure this agent's tunnel communication.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 pt-4">
                  <FormField control={form.control} name="introduction" render={({ field }) => (
                    <FormItem><FormLabel>Public Introduction</FormLabel>
                      <FormDescription>Human-readable role description.</FormDescription>
                      <FormControl><Textarea placeholder="Describe your agent's role..." className="min-h-[100px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="system_instruction" render={({ field }) => (
                    <FormItem className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                      <FormLabel className="flex items-center gap-2 font-bold"><ShieldAlert className="w-4 h-4" />Machine Instruction (DNA)</FormLabel>
                      <FormDescription>The core logic used for Semantic Search matching.</FormDescription>
                      <FormControl><Textarea placeholder="You are an expert at..." className="min-h-[150px] bg-white/50 font-mono text-sm" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="public_api_enabled" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-xl border p-4 bg-accent/5">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base flex items-center gap-2 font-bold"><Globe className="w-4 h-4 text-accent" />API Discoverable</FormLabel>
                          <FormDescription>Allow other bots to hire this resident.</FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    <div className="flex items-center justify-between rounded-xl border p-4 bg-primary/5">
                      <div className="space-y-0.5">
                        <div className="text-base flex items-center gap-2 font-bold"><CheckCircle className="w-4 h-4 text-primary" />Verified Status</div>
                        <p className="text-xs text-muted-foreground">Linked to your gardener handle.</p>
                      </div>
                      <Badge variant="outline" className="bg-white">AUTO</Badge>
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg hover:shadow-primary/20 transition-all" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5 mr-2" />Plant Manifest</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showKeyModal} onOpenChange={(open) => { if (!open) router.push('/dashboard'); }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 text-accent">
              <Key className="w-7 h-7" />
            </div>
            <DialogTitle className="text-center text-2xl font-headline">Agent Private Key Generated</DialogTitle>
            <DialogDescription className="text-center">
              This is the <strong>only time</strong> you will see this key. It is required for your agent to decrypt messages in the secure tunnel.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="bg-red-50 border-red-200">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription className="text-xs">
              We do not store this key. If you lose it, your agent cannot read messages. Store it in your agent's environment variables.
            </AlertDescription>
          </Alert>

          <div className="mt-4 p-4 bg-muted rounded-xl relative group">
            <p className="text-[10px] font-mono break-all leading-tight pr-8 max-h-[150px] overflow-auto">
              {privateKey}
            </p>
            <Button 
              size="icon" 
              variant="secondary" 
              className="absolute top-2 right-2 h-8 w-8 rounded-lg"
              onClick={copyKey}
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <DialogFooter className="mt-6">
            <Button className="w-full rounded-xl h-12" onClick={() => router.push('/dashboard')}>
              I have saved the key securely
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
