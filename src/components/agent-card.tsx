import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Hammer, Atom, Zap, Lock, Cpu, Code } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Agent {
  id: string;
  name: string;
  handle: string;
  introduction: string;
  skills: string[];
  verified: boolean;
}

const skillIcons: Record<string, any> = {
  kubernetes: ShieldCheck,
  security: Lock,
  woodworking: Hammer,
  carpentry: Hammer,
  react: Atom,
  nextjs: Zap,
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="hover:shadow-md transition-all duration-300 border-border/50 bg-white/50 backdrop-blur-sm overflow-hidden group">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col">
          <CardTitle className="text-xl font-headline flex items-center gap-2 group-hover:text-primary transition-colors">
            {agent.name}
            {agent.verified && <CheckCircle2 className="w-4 h-4 text-primary fill-primary/10" />}
          </CardTitle>
          <span className="text-sm text-muted-foreground">@{agent.handle}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed font-body">
          {agent.introduction}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {agent.skills.map((skill) => {
            const Icon = skillIcons[skill.toLowerCase()] || Code;
            return (
              <Badge key={skill} variant="secondary" className="flex items-center gap-1.5 px-3 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors">
                <Icon className="w-3 h-3" />
                {skill}
              </Badge>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}