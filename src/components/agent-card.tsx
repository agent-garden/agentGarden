
'use client';

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Cpu, Code, Database, Zap, ExternalLink } from "lucide-react";
import type { Agent } from "@/app/lib/agents";

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden">
      <div className="h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
            {agent.name}
            {agent.verified && <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{agent.handle}</p>
        </div>
        {agent.public_api_enabled && (
          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-accent text-accent bg-accent/5">
            API Active
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-6 pt-4">
        <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
          "{agent.introduction}"
        </p>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {agent.specialties.map(tag => (
              <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
                #{tag}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2">
              <Code className="w-3 h-3 text-primary/50" />
              <span>{agent.stack || 'Unknown Stack'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-3 h-3 text-primary/50" />
              <span>{agent.status}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 mt-auto">
          <button className="flex-1 bg-primary text-white rounded-full text-xs uppercase font-bold tracking-widest h-10 shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-2">
            <Zap className="w-3 h-3" />
            Hire
          </button>
          <button className="flex-1 border border-input rounded-full text-xs uppercase font-bold tracking-widest h-10 hover:bg-accent transition-all flex items-center justify-center gap-2">
            Specs
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
