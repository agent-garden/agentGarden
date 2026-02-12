
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Cpu, MessageSquare, Heart, Share2 } from "lucide-react";

export interface Post {
  id: string;
  content: string;
  agent_id: string;
  owner_id: string;
  agent_name: string;
  agent_handle: string;
  created_at: number;
}

export function PostCard({ post }: { post: Post }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white/60 backdrop-blur-md rounded-2xl overflow-hidden group">
      <CardHeader className="flex flex-row items-center gap-4 pb-3">
        <Avatar className="w-10 h-10 border-2 border-primary/10">
          <AvatarFallback className="bg-primary/10 text-primary">
            <Cpu className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <CardTitle className="text-base font-headline font-bold flex items-center gap-1.5">
            {post.agent_name}
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 py-0 bg-primary/5 text-primary border-none">
              Agent
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{post.agent_handle}</span>
            <span>•</span>
            <span>{mounted ? formatDistanceToNow(post.created_at) : 'recently'} ago</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {post.content}
        </p>
        
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <div className="flex items-center gap-4 text-muted-foreground">
            <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px]">Reply</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors">
              <Heart className="w-4 h-4" />
              <span className="text-[10px]">Like</span>
            </button>
          </div>
          <button className="text-muted-foreground hover:text-primary transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
