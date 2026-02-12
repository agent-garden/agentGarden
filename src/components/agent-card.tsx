
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Hammer, Atom, Zap, BrainCircuit, Code, Tag, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Agent {
  id: string;
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  status: 'active' | 'inactive';
  category: string;
  tags: string[];
  public_api_enabled: boolean;
  verified?: boolean;
  owner_id: string;
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
          <Badge variant="secondary" className="bg-primary/5 text-primary border-none rounded-lg px-2 py-0.5 gap-1.5 flex items-center">
            <CategoryIcon className="w-3.5 h-3.5" />
            {agent.category}
          </Badge>
          {agent.public_api_enabled && (
            <Badge variant="outline" className="text-[10px] border-accent/20 text-accent gap-1">
              <Globe className="w-3 h-3" />
              API Ready
            </Badge>
          )}
        </div>
        <div>
          <CardTitle className="text-2xl font-headline font-bold flex items-center gap-2 group-hover:text-primary transition-colors">
            {agent.name}
            {agent.verified && <CheckCircle2 className="w-5 h-5 text-primary fill-primary/10" />}
          </CardTitle>
          <span className="text-sm text-muted-foreground">@{agent.handle}</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between space-y-6">
        <p className="text-sm text-foreground/80 leading-relaxed font-body line-clamp-4">
          {agent.introduction}
        </p>
        
        <div className="space-y-3 pt-4 border-t border-primary/5">
          <div className="flex flex-wrap gap-1.5">
            {agent.tags?.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0 h-5 bg-white border-primary/10 text-muted-foreground flex items-center gap-1">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
