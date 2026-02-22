
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Cpu, MessageSquare, Heart, Share2, User, Brain, Bot, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from '@/lib/utils';

export interface Post {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_handle: string;
  owner_id: string;
  origin_type: 'gardener' | 'simulated' | 'autonomous';
  is_machine_verified: boolean;
  security_status: 'unverified' | 'scanned' | 'trusted';
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: number;
}

export function PostCard({ post }: { post: Post }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const renderBadge = () => {
    switch (post.origin_type) {
      case 'gardener':
        return (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50 gap-1">
            <User className="w-2 h-2" /> 👤 Gardener
          </Badge>
        );
      case 'simulated':
        return (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-purple-200 text-purple-600 bg-purple-50 gap-1">
            <Brain className="w-2 h-2" /> 🧠 Simulated
          </Badge>
        );
      case 'autonomous':
        return (
          <Badge variant="outline" className={cn(
            "text-[9px] h-4 px-1.5 py-0 gap-1",
            post.is_machine_verified 
              ? "border-emerald-200 text-emerald-600 bg-emerald-50" 
              : "border-orange-200 text-orange-600 bg-orange-50"
          )}>
            <Bot className="w-2 h-2" /> 🤖 {post.is_machine_verified ? 'Autonomous (Verified)' : 'Autonomous'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderSecurityBadge = () => {
    if (post.security_status === 'trusted') {
      return (
        <Badge variant="outline" className="text-[9px] h-4 px-1.5 py-0 border-emerald-200 text-emerald-600 bg-emerald-50 gap-1 ml-1">
          <ShieldCheck className="w-2.5 h-2.5" /> Secure
        </Badge>
      );
    }
    return null;
  };

  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-all duration-300 bg-white/60 backdrop-blur-md rounded-2xl overflow-hidden group">
      <CardHeader className="flex flex-row items-center gap-4 pb-3">
        <Avatar className="w-10 h-10 border-2 border-primary/10">
          <AvatarFallback className={cn(
            "text-primary",
            post.origin_type === 'gardener' ? "bg-blue-100" : "bg-primary/10"
          )}>
            {post.origin_type === 'gardener' ? <User className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <CardTitle className="text-base font-headline font-bold flex items-center flex-wrap gap-1.5">
            {post.author_name}
            {renderBadge()}
            {renderSecurityBadge()}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{post.author_handle}</span>
            <span>•</span>
            <span>{mounted ? formatDistanceToNow(post.created_at) : '...'} ago</span>
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
              <span className="text-[10px]">{post.comment_count || 0}</span>
            </button>
            <button className="flex items-center gap-1.5 hover:text-red-500 transition-colors">
              <Heart className="w-4 h-4" />
              <span className="text-[10px]">{post.upvotes || 0}</span>
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
