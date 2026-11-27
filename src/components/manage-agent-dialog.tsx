'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Loader2, RefreshCw, Settings2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { User } from 'firebase/auth';
import type { Agent } from '@/components/agent-card';
import { getAgentPrivateProfile, rotateAgentApiKey, updateAgentProfile } from '@/app/actions/onboarding';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export function ManageAgentDialog({
  agent,
  user,
  open,
  onOpenChange,
}: {
  agent: Agent | null;
  user: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState('Coding');
  const [introduction, setIntroduction] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [stack, setStack] = useState('');
  const [location, setLocation] = useState('Cloud');
  const [timezone, setTimezone] = useState('UTC');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [availability, setAvailability] = useState<'Active' | 'Busy' | 'Idle'>('Active');
  const [systemInstruction, setSystemInstruction] = useState('');
  const [loadingPrivate, setLoadingPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [freshApiKey, setFreshApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!agent || !open) {
      setConfirmRotate(false);
      setFreshApiKey(null);
      setCopiedKey(false);
      return;
    }
    setCategory(agent.category || 'Coding');
    setIntroduction(agent.introduction || '');
    setSpecialties(Array.isArray(agent.specialties) ? agent.specialties.join(', ') : '');
    setStack(agent.stack || '');
    setLocation(agent.location || 'Cloud');
    setTimezone(agent.timezone || 'UTC');
    setEndpointUrl((agent as any).endpoint_url || '');
    setStatus(agent.status === 'inactive' ? 'inactive' : 'active');
    setAvailability((agent.availability as any) === 'Busy' ? 'Busy' : agent.availability === 'Idle' ? 'Idle' : 'Active');
    setSystemInstruction('');

    let cancelled = false;
    setLoadingPrivate(true);
    user
      .getIdToken()
      .then((t) => getAgentPrivateProfile(t, agent.id))
      .then((priv) => {
        if (!cancelled) setSystemInstruction(priv.system_instruction || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingPrivate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agent, open, user]);

  if (!agent) return null;

  const handleSave = async () => {
    const tags = specialties
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    if (tags.length === 0) {
      toast({ variant: 'destructive', title: 'Add at least one specialty tag' });
      return;
    }
    setSaving(true);
    try {
      const res = await updateAgentProfile(await user.getIdToken(), {
        agentId: agent.id,
        category,
        introduction,
        specialties: tags,
        stack,
        location,
        timezone,
        endpoint_url: endpointUrl.trim(),
        status,
        availability,
        system_instruction: systemInstruction.trim().length >= 20 ? systemInstruction.trim() : undefined,
      });
      toast({
        title: 'Agent updated',
        description: `${agent.name}'s profile and search embedding are synced (security: ${res.auditStatus}).`,
      });
      if (!freshApiKey) onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: e.message || 'Could not save changes.' });
    } finally {
      setSaving(false);
    }
  };

  const handleRotateKey = async () => {
    setRotating(true);
    try {
      const res = await rotateAgentApiKey(await user.getIdToken(), agent.id);
      setFreshApiKey(res.apiKey);
      setConfirmRotate(false);
      toast({
        title: 'API key rotated',
        description: 'Previous ag_... keys are revoked. Copy your new key now—it is shown only once.',
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Rotation failed', description: e.message || 'Could not rotate API key.' });
    } finally {
      setRotating(false);
    }
  };

  const profilePath = `/agents/${(agent.handle || agent.id).replace(/^@/, '')}`;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && freshApiKey && !copiedKey) {
          // Allow explicit close button while nudging copy
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Manage {agent.name}
            </DialogTitle>
            <Button asChild variant="outline" size="sm" className="rounded-full gap-1.5 text-xs">
              <Link href={profilePath} target="_blank">
                Public Profile <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </Button>
          </div>
          <DialogDescription>
            Update {agent.handle}&apos;s directory profile, operational status, instructions, or rotate its API key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Directory Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Listed)</SelectItem>
                  <SelectItem value="inactive">Inactive (Paused)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Availability</Label>
              <Select value={availability} onValueChange={(v) => setAvailability(v as 'Active' | 'Busy' | 'Idle')}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Busy">Busy</SelectItem>
                  <SelectItem value="Idle">Idle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Coding">Coding</SelectItem>
                  <SelectItem value="Research">Research</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Writing">Writing</SelectItem>
                  <SelectItem value="Creative">Creative</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Public Introduction (10–500 chars)</Label>
            <Textarea
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              maxLength={500}
              className="rounded-xl min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Specialties (comma-separated)</Label>
              <Input
                value={specialties}
                onChange={(e) => setSpecialties(e.target.value)}
                placeholder="solana, rust, security-audit"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Model / Tech Stack</Label>
              <Input
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                maxLength={80}
                placeholder="Gemini 2.5 Pro · Rust"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} maxLength={60} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Endpoint URL (optional)</Label>
              <Input
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                maxLength={300}
                placeholder="https://..."
                className="rounded-xl font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Private System Instructions (&ldquo;DNA&rdquo; — stored in owner-only vault)</Label>
              {loadingPrivate && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>
            <Textarea
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              maxLength={8000}
              placeholder={loadingPrivate ? 'Loading private instructions...' : 'System instructions (20–8000 chars)...'}
              className="rounded-xl font-mono text-xs min-h-[110px]"
            />
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold flex items-center gap-1.5 text-amber-950">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  Machine API Key (`ag_...`)
                </p>
                <p className="text-xs text-amber-900/80">
                  Rotating immediately invalidates the old key across MCP and HTTP endpoints.
                </p>
              </div>
              {!confirmRotate && !freshApiKey && (
                <Button type="button" variant="outline" size="sm" className="rounded-xl border-amber-300 bg-white" onClick={() => setConfirmRotate(true)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Rotate Key
                </Button>
              )}
            </div>

            {confirmRotate && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-200">
                <span className="text-xs font-semibold text-amber-950">Revoke current key and issue a new one?</span>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={() => setConfirmRotate(false)} disabled={rotating}>
                    Cancel
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="rounded-xl" onClick={handleRotateKey} disabled={rotating}>
                    {rotating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Confirm Rotate
                  </Button>
                </div>
              </div>
            )}

            {freshApiKey && (
              <div className="p-3 bg-white rounded-xl border border-emerald-300 space-y-2">
                <p className="text-xs font-bold text-emerald-800">New API Key (save now — shown once):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-muted p-2 rounded-lg break-all">{freshApiKey}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl shrink-0 gap-1.5"
                    onClick={() => {
                      navigator.clipboard?.writeText(freshApiKey);
                      setCopiedKey(true);
                      toast({ title: 'API key copied to clipboard' });
                    }}
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
            Close
          </Button>
          <Button type="button" className="rounded-xl font-bold" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
