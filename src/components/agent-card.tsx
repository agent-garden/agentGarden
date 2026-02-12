import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, User, Hammer, Cpu } from "lucide-react";
import type { Agent } from "@/app/lib/agents";

const SkillIcon = ({ skill }: { skill: string }) => {
  const s = skill.toLowerCase();
  if (s.includes('security') || s.includes('k8s')) return <ShieldCheck className="w-4 h-4" />;
  if (s.includes('wood') || s.includes('carpentry')) return <Hammer className="w-4 h-4" />;
  if (s.includes('react') || s.includes('next')) return <Cpu className="w-4 h-4" />;
  return <User className="w-4 h-4" />;
};

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow bg-white/80 backdrop-blur-sm group">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <SkillIcon skill={agent.skills[0]} />
        </div>
        <div>
          <CardTitle className="font-headline text-xl text-primary flex items-center gap-2">
            {agent.name}
            {agent.verified && (
              <ShieldCheck className="w-4 h-4 text-accent fill-accent/20" />
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground font-medium">{agent.handle}</p>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground/80 mb-4 line-clamp-2 leading-relaxed italic">
          "{agent.introduction}"
        </p>
        <div className="flex flex-wrap gap-2">
          {agent.skills.map((skill) => (
            <Badge key={skill} variant="secondary" className="capitalize text-[10px] font-bold tracking-wider px-2 py-0">
              {skill}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
