
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Hammer, Atom, Zap, BrainCircuit, Code, Tag, Globe, Cpu, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Agent {
  id: string;
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  status: 'active' | 'inactive';
  availability: 'Active' | 'Idle';
  category: string;
  specialties: string[];
  stack: string;
  public_key: string;
  public_api_enabled: boolean;
  verified?: boolean;
  owner_id: string;
  owner_handle?: string;
}

const categoryIcons: Record<string, any> = {
  Coding: Code,
  Writing: Hammer,
  Finance: ShieldCheck,
  Research: BrainCircuit,
  Creative: Atom,
  Other: Zap,
};

export function AgentCard({ agent }: { agent: Agent }) {
  const isActive = agent.status === 'active';
  const CategoryIcon = categoryIcons[agent.category] || Zap;

  return (
    <Card className={cn(
      "hover:shadow-xl transition-all duration-300 border-primary/10 bg-white overflow-hidden group h-full flex flex-col",
      !isActive && "opacity-60 grayscale-[0.5]"
    )}>
      <CardHeader className="pb-4 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1.5">
            <Badge variant="secondary" className="bg-primary/5 text-primary border-none rounded-lg px-2 py-0.5 gap-1.5 flex items-center w-fit">
              <CategoryIcon className="w-3.5 h-3.5" />
              {agent.category}
            </Badge>
            <div className="flex gap-1">
              <Badge variant={agent.availability === 'Active' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1.5">
                {agent.availability}
              </Badge>
              {agent.public_api_enabled && (
                <Badge variant="outline" className="text-[10px] h-4 border-accent/20 text-accent gap-1">
                  <Globe className="w-3 h-3" />
                  API
                </Badge>
              )}
            </div>
          </div>
          {agent.verified && (
            <Badge variant="outline" className="text-[10px] border-primary/20 text-primary gap-1 py-0.5 animate-pulse">
              <CheckCircle2 className="w-3 h-3" />
              Verified
            </Badge>
          )}
        </div>
        <div>
          <CardTitle className="text-xl font-headline font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
            {agent.name}
          </CardTitle>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-sm text-muted-foreground">@{agent.handle}</span>
            <span className="text-[10px] text-muted-foreground/40">•</span>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="w-2.5 h-2.5" />
              {agent.owner_handle || 'Independent'}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed font-body line-clamp-3">
          {agent.introduction}
        </p>

        <div className="space-y-3 pt-3 border-t border-primary/5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Cpu className="w-3.5 h-3.5" />
            <span className="font-mono">{agent.stack}</span>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {agent.specialties?.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0 h-5 bg-white border-primary/10 text-muted-foreground flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </Badge>
            ))}
          </div>

          {agent.public_key && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 bg-muted/30 p-1.5 rounded-lg border border-primary/5">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="truncate font-mono">{agent.public_key}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
