'use client';

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Cpu, Code, Database, Zap, ExternalLink, Globe, Copy, Info } from "lucide-react";
import type { Agent } from "@/app/lib/agents";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AgentCard({ agent }: { agent: Agent }) {
  const { toast } = useToast();

  const copyId = () => {
    navigator.clipboard.writeText(agent.id);
    toast({
      title: "ID Copied",
      description: "Ready for Manager Agent deployment.",
    });
  };

  return (
    <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm group hover:scale-[1.02] transition-all flex flex-col overflow-hidden h-full">
      <div className="h-1 bg-primary/20 group-hover:bg-primary transition-colors" />
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
          <Cpu className="w-5 h-5" />
          {agent.verified && (
            <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="font-headline text-2xl text-primary truncate">
            {agent.name}
          </CardTitle>
          <div className="flex items-center gap-2">
             <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest truncate">{agent.handle}</p>
             <button onClick={copyId} className="text-muted-foreground hover:text-primary transition-colors">
               <Copy className="w-3 h-3" />
             </button>
          </div>
        </div>
        {agent.public_api_enabled && (
          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter border-accent text-accent bg-accent/5 shrink-0">
            API Active
          </Badge>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 space-y-6 pt-4 flex flex-col">
        <div className="relative">
          <p className="text-sm text-foreground/80 italic leading-relaxed line-clamp-3 h-[60px]">
            "{agent.introduction}"
          </p>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -right-2 -top-2 cursor-help opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                {agent.introduction}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {agent.specialties.slice(0, 4).map(tag => (
              <Badge key={tag} variant="secondary" className="bg-primary/5 text-primary text-[10px] uppercase font-bold px-2 py-0 border-none">
                #{tag}
              </Badge>
            ))}
            {agent.specialties.length > 4 && (
              <Badge variant="ghost" className="text-[10px] font-bold text-muted-foreground">
                +{agent.specialties.length - 4} More
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-2 truncate">
              <Code className="w-3 h-3 text-primary/50 shrink-0" />
              <span className="truncate">{agent.stack || 'Gemini Flash'}</span>
            </div>
            <div className="flex items-center gap-2 truncate">
              {agent.endpoint_url ? (
                <div className="flex items-center gap-2 text-accent truncate">
                   <Globe className="w-3 h-3 shrink-0" />
                   <span className="truncate">RPC Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 truncate">
                  <Database className="w-3 h-3 text-primary/50 shrink-0" />
                  <span className="truncate">{agent.status}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 mt-auto">
          <Button className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 shadow-md hover:shadow-lg transition-all gap-2">
            <Zap className="w-3 h-3" />
            Hire Specialist
          </Button>
          <Button variant="outline" className="flex-1 rounded-full text-xs uppercase font-bold tracking-widest h-10 hover:bg-accent hover:text-white transition-all gap-2">
            Protocol
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
