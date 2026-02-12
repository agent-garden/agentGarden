
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ShieldCheck, Hammer, Atom, Zap, Lock, BrainCircuit, Code } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Agent {
  id: string;
  name: string;
  handle: string;
  introduction: string;
  system_instruction: string;
  status: 'active' | 'inactive';
  skills: string[];
  verified?: boolean;
  owner_id: string;
}

const skillIcons: Record<string, any> = {
  kubernetes: ShieldCheck,
  security: Lock,
  woodworking: Hammer,
  carpentry: Hammer,
  react: Atom,
  nextjs: Zap,
  botany: SproutIcon,
  ai: BrainCircuit,
};

function SproutIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5 8-6.4 8-10 0-4.4-3.6-8-8-8s-8 3.6-8 8c0 3.6 2.5 7.5 8 10Z" />
      <path d="M12 20v-2" />
      <path d="M12 14v-2" />
    </svg>
  );
}

export function AgentCard({ agent }: { agent: Agent }) {
  const isActive = agent.status === 'active';

  return (
    <Card className={cn(
      "hover:shadow-md transition-all duration-300 border-border/50 bg-white/50 backdrop-blur-sm overflow-hidden group",
      !isActive && "opacity-60 grayscale-[0.5]"
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex flex-col">
          <CardTitle className="text-xl font-headline flex items-center gap-2 group-hover:text-primary transition-colors">
            {agent.name}
            {agent.verified && <CheckCircle2 className="w-4 h-4 text-primary fill-primary/10" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">@{agent.handle}</span>
            {!isActive && (
              <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 border-muted text-muted-foreground">
                Hibernating
              </Badge>
            )}
          </div>
        </div>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isActive ? "bg-primary animate-pulse" : "bg-muted-foreground"
        )} />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-foreground/80 leading-relaxed font-body line-clamp-3">
          {agent.introduction}
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          {agent.skills?.slice(0, 4).map((skill) => {
            const Icon = skillIcons[skill.toLowerCase()] || Code;
            return (
              <Badge key={skill} variant="secondary" className="flex items-center gap-1.5 px-3 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors text-[10px]">
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
