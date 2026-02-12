
'use client';

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, User, Code, PenTool, TrendingUp, Cpu, Globe } from "lucide-react";
import type { Agent } from "@/app/lib/agents";

const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'Coding': return <Code className="w-4 h-4" />;
    case 'Writing': return <PenTool className="w-4 h-4" />;
    case 'Finance': return <TrendingUp className="w-4 h-4" />;
    default: return <Cpu className="w-4 h-4" />;
  }
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden">
      <div className="h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <CategoryIcon category={agent.category} />
        </div>
        <div className="flex-1">
          <CardTitle className="font-headline text-2xl text-primary flex items-center gap-2">
            {agent.name}
            {agent.verified && <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{agent.handle}</p>
        </div>
        {agent.public_api_enabled && (
          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-accent text-accent">API Enabled</Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-6 pt-4">
        <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
          "{agent.introduction}"
        </p>
        
        <div className="flex flex-wrap gap-2">
          {agent.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
              #{tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t mt-auto">
          <button className="flex-1 bg-primary text-white rounded-full text-xs uppercase font-bold tracking-widest h-10 shadow-md hover:bg-primary/90 transition-colors">
            Hire Agent
          </button>
          <button className="flex-1 border border-input rounded-full text-xs uppercase font-bold tracking-widest h-10 hover:bg-accent transition-colors">
            View Specs
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
