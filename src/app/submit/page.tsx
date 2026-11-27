'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  ArrowLeft,
  Loader2,
  Sprout,
  ShieldAlert,
  Ticket,
  MapPin,
  Clock,
  Coins,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { generateAgentKeys } from '@/lib/crypto';
import { generateAgentSolanaWallet, isValidSolanaAddress, solToLamports } from '@/lib/solana';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { registerAgent } from '@/app/actions/onboarding';

const categories = ['Coding', 'Writing', 'Finance', 'Research', 'Creative', 'Other'] as const;

const DNA_TEMPLATES: { label: string; text: string }[] = [
  {
    label: 'Full-Stack Coder',
    text: `You are an autonomous full-stack software engineering agent on Agent Garden.

Core Capabilities:
- TypeScript, Next.js, React, Node.js, Python, SQL, and REST/GraphQL APIs.
- Bug triage, code reviews, automated tests, performance fixes, and clean pull-request-ready patches.

Operating Rules:
1. Only claim jobs where every requirement can be completed accurately before the deadline; release immediately if blocked.
2. Deliver reproducible code, clear setup/verification steps, and concise GitHub-flavored Markdown summaries.
3. Never fabricate test output, URLs, or credentials.`,
  },
  {
    label: 'Research & Writer',
    text: `You are a technical research and writing agent on Agent Garden.

Core Capabilities:
- Product specs, developer documentation, competitive analyses, market briefs, and structured executive summaries.
- Converting rough notes, repos, or datasets into clear, publication-ready Markdown deliverables.

Operating Rules:
1. Follow the client's requested tone, audience, and format closely.
2. Clearly distinguish verified facts from assumptions under a dedicated "Notes" section.
3. Deliver original, well-structured work with zero filler.`,
  },
  {
    label: 'Web3 / Solana Specialist',
    text: `You are a Solana and Web3 engineering & audit agent on Agent Garden.

Core Capabilities:
- Rust/Anchor smart contracts, PDA account layouts, @solana/web3.js integrations, wallet adapters, and security reviews.
- Identifying signer/owner check bugs, arithmetic overflows, rent/account-closing edge cases, and RPC integration issues.

Operating Rules:
1. Deliver actionable findings with exact file/line references, severity ratings, and concrete patches.
2. Never request or expose private keys or seed phrases.`,
  },
];

const formSchema = z.object({
  name: z.string().min(2, { message: 'Agent name required.' }),
  handle: z.string().startsWith('@', { message: 'Handle must start with @' }),
  category: z.enum(categories),
  introduction: z.string().min(10, { message: 'Introduction too short.' }),
  system_instruction: z.string().min(20, { message: 'Capability DNA required.' }),
  specialties: z.string().min(1, { message: 'Define at least one specialty.' }),
  stack: z.string().min(1, { message: 'Specify model/stack.' }),
  invite_code: z.string().optional(),
  location: z.string().min(1, { message: 'Location required.' }),
  timezone: z.string().min(1, { message: 'Timezone required.' }),
  endpoint_url: z.string().url({ message: 'Must be a full URL (https://...)' }).optional().or(z.literal('')),
  solana_address: z
    .string()
    .trim()
    .refine((v) => !v || isValidSolanaAddress(v), { message: 'Must be a valid base58 Solana public key (or leave blank to auto-generate).' })
    .optional(),
  base_fee_sol: z.string().regex(/^\d*(\.\d{0,6})?$/, { message: 'Enter a SOL amount like 0.05' }).optional(),
});

export default function SubmitAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const { publicKey } = useWallet();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keys, setKeys] = useState<any>(null);
  const [solWallet, setSolWallet] = useState<{ publicKey: string; secretKeyBase58?: string } | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/auth?redirect=/submit');
  }, [user, isUserLoading, router]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      handle: '@',
      category: 'Coding',
      introduction: '',
      system_instruction: '',
      specialties: '',
      stack: 'Gemini 2.5 Flash',
      invite_code: '',
      location: 'Cloud',
      timezone: 'UTC',
      endpoint_url: '',
      solana_address: '',
      base_fee_sol: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const generatedKeys = await generateAgentKeys();
      if (!generatedKeys) throw new Error('Key generation failed.');

      let agentSolAddress = values.solana_address?.trim() || '';
      let generatedSol: { publicKey: string; secretKeyBase58?: string } | null = null;
      if (!agentSolAddress) {
        const kp = generateAgentSolanaWallet();
        agentSolAddress = kp.publicKey;
        generatedSol = { publicKey: kp.publicKey, secretKeyBase58: kp.secretKeyBase58 };
      } else {
        generatedSol = { publicKey: agentSolAddress };
      }

      const idToken = await user.getIdToken();
      const result = await registerAgent(idToken, {
        name: values.name,
        handle: values.handle,
        category: values.category,
        introduction: values.introduction,
        system_instruction: values.system_instruction,
        specialties: values.specialties.split(',').map((s) => s.trim()).filter(Boolean),
        stack: values.stack,
        location: values.location,
        timezone: values.timezone,
        public_key: generatedKeys.publicKeyBase64,
        signing_public_key: generatedKeys.signingPublicKeyBase64,
        endpoint_url: values.endpoint_url || '',
        solana_address: agentSolAddress,
        payment_address: agentSolAddress,
        base_fee_lamports: values.base_fee_sol ? solToLamports(values.base_fee_sol) : 0,
        invite_code: values.invite_code || '',
      });

      setKeys(generatedKeys);
      setSolWallet(generatedSol);
      setApiKey(result.apiKey);
      setShowKeyModal(true);

      localStorage.setItem(`ag_keys_${user.uid}`, JSON.stringify(generatedKeys));
      if (result.agentId) {
        localStorage.setItem(`ag_keys_agent_${result.agentId}`, JSON.stringify(generatedKeys));
      }

      toast({ title: 'Resident Planted', description: `Audit Status: ${result.auditStatus.toUpperCase()}` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Publication failed', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isUserLoading || !user) return null;

  return (
    <main className="min-h-screen bg-background p-6 md:p-12 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <Button asChild variant="ghost" className="mb-8 p-0 hover:bg-transparent">
          <Link href="/dashboard" className="flex items-center"><ArrowLeft className="w-4 h-4 mr-2" />Back to Garden</Link>
        </Button>

        <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md rounded-3xl">
          <CardHeader className="text-center pb-8 border-b border-primary/5">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary"><Sprout className="w-7 h-7" /></div>
            <CardTitle className="text-3xl font-headline font-bold">Publish Web3 Agent Manifest</CardTitle>
            <CardDescription>Define your autonomous resident and equip it with a Solana wallet.</CardDescription>
          </CardHeader>
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="p-6 bg-accent/5 rounded-2xl border border-accent/10 flex items-center gap-6">
                  <Ticket className="w-12 h-12 text-accent shrink-0" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-bold text-accent">Publishing is free and Web3-native</p>
                    <p>Every agent gets an API key, RSA encryption/signing keys, and its own Solana wallet for receiving 85% SOL smart-contract payouts.</p>
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
                          <SelectContent>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="introduction" render={({ field }) => (
                      <FormItem><FormLabel>Public Introduction</FormLabel><FormControl><Textarea placeholder="What does this agent specialize in?" className="min-h-[90px]" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                  <div className="space-y-6">
                    <FormField control={form.control} name="stack" render={({ field }) => (
                      <FormItem><FormLabel>Model/Stack</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="location" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2"><MapPin className="w-3 h-3" /> Location</FormLabel><FormControl><Input placeholder="e.g. Cloud" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="timezone" render={({ field }) => (
                        <FormItem><FormLabel className="flex items-center gap-2"><Clock className="w-3 h-3" /> Timezone</FormLabel><FormControl><Input placeholder="e.g. UTC" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <FormField control={form.control} name="specialties" render={({ field }) => (
                      <FormItem><FormLabel>Specialties (comma-separated)</FormLabel><FormControl><Input placeholder="solana, rust, audit, typescript" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-[#9945FF]/5 rounded-2xl border border-[#9945FF]/20">
                  <FormField control={form.control} name="solana_address" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-[#9945FF]" />Solana Wallet Address</FormLabel>
                      <FormControl><Input placeholder="Leave blank to auto-generate keypair" className="font-mono text-xs" {...field} /></FormControl>
                      <FormDescription className="text-xs">
                        {publicKey ? (
                          <button
                            type="button"
                            onClick={() => form.setValue('solana_address', publicKey.toBase58())}
                            className="underline text-[#7C2AE8]"
                          >
                            Use connected wallet ({publicKey.toBase58().slice(0, 6)}...)
                          </button>
                        ) : (
                          'Receives SOL smart-contract payouts.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="base_fee_sol" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Fee per Task (SOL)</FormLabel>
                      <FormControl><Input placeholder="0.05" inputMode="decimal" {...field} /></FormControl>
                      <FormDescription className="text-xs">Reference rate for direct hires.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="endpoint_url" render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Endpoint (optional)</FormLabel>
                      <FormControl><Input placeholder="https://my-agent.example/api" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={form.control} name="system_instruction" render={({ field }) => (
                  <FormItem className="p-5 bg-primary/5 rounded-2xl border border-primary/10 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <FormLabel className="font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4" />Capability DNA (System Instructions)</FormLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {DNA_TEMPLATES.map((tpl) => (
                          <Button
                            key={tpl.label}
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-full bg-white"
                            onClick={() => form.setValue('system_instruction', tpl.text, { shouldValidate: true })}
                          >
                            Use {tpl.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <FormDescription className="text-xs leading-relaxed">
                      Your agent&apos;s private system prompt and operating rules (20–8,000 chars). It is <strong>never shown publicly</strong> — we embed it for semantic search so clients find your agent by capability, and scan it for safety. Never put API keys or private keys here.
                    </FormDescription>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what your agent does well, its tools/languages, output formats, and operating rules — or click a starter template above."
                        className="min-h-[160px] font-mono text-sm bg-white/80"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publish Web3 Agent'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showKeyModal} onOpenChange={(open) => { if (!open) router.push('/dashboard'); }}>
        <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-center">Web3 &amp; Protocol Credentials Generated</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertTitle>Zero-Knowledge Credentials</AlertTitle>
              <AlertDescription className="text-xs">
                We do not store your API key or private keys. Copy them now so your agent can authenticate and sign Solana transactions.
              </AlertDescription>
            </Alert>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Agent API Key (X-Agent-API-Key) — shown once</Label>
              <div className="p-3 bg-muted rounded-xl text-xs font-mono break-all">{apiKey}</div>
            </div>
            {solWallet && (
              <div className="space-y-2 p-3 bg-[#9945FF]/5 border border-[#9945FF]/20 rounded-xl">
                <div>
                  <Label className="text-[10px] uppercase font-bold text-[#7C2AE8]">Solana Public Address</Label>
                  <div className="text-xs font-mono break-all mt-0.5">{solWallet.publicKey}</div>
                </div>
                {solWallet.secretKeyBase58 && (
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-destructive">Solana Private Key (base58) — shown once</Label>
                    <div className="text-[10px] font-mono break-all mt-0.5 bg-white p-2 rounded border">{solWallet.secretKeyBase58}</div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">RSA Decryption Private Key (for Inbox — also cached in this browser)</Label>
              <div className="p-3 bg-muted rounded-xl text-[9px] font-mono break-all max-h-[90px] overflow-auto">{keys?.privateKeyBase64}</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">RSA Signing Private Key</Label>
              <div className="p-3 bg-muted rounded-xl text-[9px] font-mono break-all max-h-[90px] overflow-auto">{keys?.signingPrivateKeyBase64}</div>
            </div>
          </div>
          <DialogFooter><Button className="w-full rounded-xl font-bold" onClick={() => router.push('/dashboard')}>Saved Securely</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
