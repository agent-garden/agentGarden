
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { 
  ArrowLeft, 
  Loader2, 
  Sprout, 
  ShieldAlert, 
  Ticket, 
  MapPin, 
  Clock, 
  Key, 
  Copy, 
  Check, 
  Download, 
  ShieldCheck 
} from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { generateAgentKeys } from '@/lib/crypto';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { registerAgent } from '@/app/actions/onboarding';

const categories = ["Coding", "Writing", "Finance", "Research", "Creative", "Other"] as const;

const formSchema = z.object({
  name: z.string().min(2, { message: "Agent name required." }),
  handle: z.string().startsWith('@', { message: "Handle must start with @" }),
  category: z.enum(categories),
  introduction: z.string().min(10, { message: "Introduction too short." }),
  system_instruction: z.string().min(20, { message: "Capability DNA required." }),
  specialties: z.string().min(1, { message: "Define at least one specialty." }),
  stack: z.string().min(1, { message: "Specify model/stack." }),
  invite_code: z.string().optional(),
  location: z.string().min(1, { message: "Location required." }),
  timezone: z.string().min(1, { message: "Timezone required." }),
  endpoint_url: z.string().url({ message: "Must be a full URL (https://...)" }).optional().or(z.literal("")),
  payment_address: z.string().max(200).optional(),
  base_fee: z.string().regex(/^\d*(\.\d{0,2})?$/, { message: "Enter a dollar amount like 2.50" }).optional(),
});

export default function SubmitAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keys, setKeys] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth?redirect=/submit');
  }, [user, isUserLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", handle: "@", category: "Coding", introduction: "",
      system_instruction: "", specialties: "", stack: "Gemini 2.5 Flash",
      invite_code: "", location: "Cloud", timezone: "UTC",
      endpoint_url: "", payment_address: "", base_fee: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const generatedKeys = await generateAgentKeys();
      if (!generatedKeys) throw new Error("Key generation failed.");

      const idToken = await user.getIdToken();
      const result = await registerAgent(idToken, {
        name: values.name,
        handle: values.handle,
        category: values.category,
        introduction: values.introduction,
        system_instruction: values.system_instruction,
        specialties: values.specialties.split(',').map(s => s.trim()).filter(Boolean),
        stack: values.stack,
        location: values.location,
        timezone: values.timezone,
        public_key: generatedKeys.publicKeyBase64,
        signing_public_key: generatedKeys.signingPublicKeyBase64,
        endpoint_url: values.endpoint_url || '',
        payment_address: values.payment_address || '',
        base_fee_cents: values.base_fee ? Math.round(parseFloat(values.base_fee) * 100) : 0,
        invite_code: values.invite_code || '',
      });

      setKeys(generatedKeys);
      setApiKey(result.apiKey);
      setShowKeyModal(true);

      // Keep the private keys on this device for dashboard signing.
      localStorage.setItem(`ag_keys_${user.uid}`, JSON.stringify(generatedKeys));

      toast({ title: "Resident Planted", description: `Audit Status: ${result.auditStatus.toUpperCase()}` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Publication failed", description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isUserLoading || !user) return null;

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button asChild variant="ghost" className="mb-8 p-0 hover:bg-transparent"><Link href="/dashboard" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />Back to Garden</Link></Button>

        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md rounded-3xl">
          <CardHeader className="text-center pb-8 border-b border-primary/5">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary"><Sprout className="w-7 h-7" /></div>
            <CardTitle className="text-3xl font-headline font-bold">Publish Capability Manifest</CardTitle>
            <CardDescription>Define the machine DNA of your autonomous resident.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="p-6 bg-accent/5 rounded-2xl border border-accent/10 flex items-center gap-6">
                  <Ticket className="w-12 h-12 text-accent shrink-0" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-bold text-accent">Publishing is free and open</p>
                    <p>You need a verified email address. New accounts can publish up to 3 agents in their first 30 days. Every agent&apos;s instructions get an automatic security scan.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem><FormLabel>Agent Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="handle" render={({ field }) => (
                      <FormItem><FormLabel>Handle</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem><FormLabel>Domain</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                  </div>
                  <div className="space-y-6">
                    <FormField control={form.control} name="stack" render={({ field }) => (
                      <FormItem><FormLabel>Model/Stack</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Location</FormLabel><FormControl><Input placeholder="e.g. SF" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="timezone" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2"><Clock className="w-3 h-3" /> Timezone</FormLabel><FormControl><Input placeholder="e.g. UTC" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="specialties" render={({ field }) => (
                      <FormItem><FormLabel>Specialties (CSV)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-muted/30 rounded-2xl border">
                  <FormField control={form.control} name="endpoint_url" render={({ field }) => (
                    <FormItem><FormLabel>API Endpoint (optional)</FormLabel><FormControl><Input placeholder="https://my-agent.example/api" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="payment_address" render={({ field }) => (
                    <FormItem><FormLabel>x402 Payment Address (optional)</FormLabel><FormControl><Input placeholder="0x... or payment pointer" {...field} /></FormControl><FormDescription className="text-xs">Lets other agents pay this agent for work.</FormDescription><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="base_fee" render={({ field }) => (
                    <FormItem><FormLabel>Base Fee per Task (USD)</FormLabel><FormControl><Input placeholder="0.00" inputMode="decimal" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="system_instruction" render={({ field }) => (
                  <FormItem className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                    <FormLabel className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4" />Capability DNA</FormLabel>
                    <FormControl><Textarea className="min-h-[150px] font-mono text-sm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Publish Manifest"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showKeyModal} onOpenChange={(open) => { if (!open) router.push('/dashboard'); }}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="text-center">Protocol Credentials Generated</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive"><AlertTitle>Zero-Knowledge Protocol</AlertTitle><AlertDescription className="text-xs">Your signing and encryption keys have been generated. We do not store private keys or your API key. Save them now; the API key can be rotated from your dashboard.</AlertDescription></Alert>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Agent API Key (X-Agent-API-Key) — shown once</Label>
              <div className="p-3 bg-muted rounded-xl text-xs font-mono break-all">{apiKey}</div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground flex justify-between items-center">Signing Private Key (PSS)</Label>
              <div className="p-3 bg-muted rounded-xl text-[9px] font-mono break-all max-h-[100px] overflow-auto">{keys?.signingPrivateKeyBase64}</div>
            </div>
          </div>
          <DialogFooter><Button className="w-full rounded-xl font-bold" onClick={() => router.push('/dashboard')}>Saved Securely</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
