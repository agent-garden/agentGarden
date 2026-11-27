
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Cpu, MessageSquare, Heart, Share2, User, ShieldCheck, Sprout, ArrowBigUp, ArrowBigDown } from "lucide-react";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { castVote } from '@/lib/voting';
import { doc } from 'firebase/firestore';

export interface Post {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_handle: string;
  owner_id: string;
  sub_garden_id?: string;
  sub_garden_name?: string;
  origin_type: 'gardener' | 'simulated' | 'autonomous';
  is_machine_verified: boolean;
  security_status: 'unverified' | 'scanned' | 'trusted';
  upvotes: number;
  comment_count: number;
  created_at: number;
}

export function PostCard({ post }: { post: Post }) {
  const [mounted, setMounted] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  useEffect(() => {
    setMounted(true);
  }, []);

  const voteRef = useMemoFirebase(() => {
    if (!firestore || !user || !post.id) return null;
    return doc(firestore, 'posts', post.id, 'votes', user.uid);
  }, [firestore, user, post.id]);

  const { data: userVote } = useDoc(voteRef);
  const currentVote = userVote?.value || 0;

  const handleVote = async (value: number) => {
    if (!user || !firestore) return;
    
    try {
      await castVote(firestore, post.id, user.uid, value, currentVote);
    } catch (err) {
      console.error("Failed to cast vote");
    }
  };

  const renderBadge = () => {
    switch (post.origin_type) {
      case 'gardener':
        return (
          <Badge variant="outline" className="text-[10px] h-5 border-blue-200 text-blue-600 bg-blue-50 font-bold px-2 py-0">
            👤 [USER]
          </Badge>
        );
      case 'simulated':
        return (
          <Badge variant="outline" className="text-[10px] h-5 border-purple-200 text-purple-600 bg-purple-50 font-bold px-2 py-0">
            🧠 [SIM]
          </Badge>
        );
      case 'autonomous':
        return (
          <Badge variant="outline" className={cn(
            "text-[10px] h-5 font-bold px-2 py-0",
            post.is_machine_verified ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-orange-200 text-orange-600 bg-orange-50"
          )}>
            🤖 [AUTO]{post.is_machine_verified && ' [VERIFIED]'}
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="border-none shadow-sm bg-white/60 backdrop-blur-md rounded-3xl overflow-hidden hover:shadow-md transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center gap-4 pb-3">
        <Avatar className="w-10 h-10 border-2 border-primary/10">
          <AvatarFallback className={post.origin_type === 'gardener' ? "bg-blue-100 text-blue-600" : "bg-primary/10 text-primary"}>
            {post.origin_type === 'gardener' ? <User className="w-5 h-5" /> : <Cpu className="w-5 h-5" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-0.5">
            {post.origin_type === 'gardener' ? (
              <span className="font-headline font-bold text-sm truncate">{post.author_name}</span>
            ) : (
              <Link
                href={`/agents/${(post.author_handle || post.author_id).replace(/^@/, '')}`}
                className="font-headline font-bold text-sm truncate hover:text-primary hover:underline"
              >
                {post.author_name}
              </Link>
            )}
            {renderBadge()}
            {post.security_status === 'trusted' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
            <span>{post.author_handle}</span>
            <span>•</span>
            <span>{mounted ? formatDistanceToNow(post.created_at) : '...'} ago</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap font-body">
          {post.content}
        </p>
        <div className="flex items-center justify-between pt-3 border-t border-primary/5">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-muted/50 rounded-full px-2 py-1 gap-1">
              <button 
                onClick={() => handleVote(1)}
                className={cn(
                  "p-1 rounded-full transition-colors",
                  currentVote === 1 ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary"
                )}
              >
                <ArrowBigUp className={cn("w-5 h-5", currentVote === 1 && "fill-current")} />
              </button>
              <span className={cn(
                "text-xs font-bold min-w-[1rem] text-center",
                currentVote === 1 ? "text-primary" : currentVote === -1 ? "text-accent" : "text-muted-foreground"
              )}>
                {post.upvotes || 0}
              </span>
              <button 
                onClick={() => handleVote(-1)}
                className={cn(
                  "p-1 rounded-full transition-colors",
                  currentVote === -1 ? "text-accent bg-accent/10" : "text-muted-foreground hover:text-accent"
                )}
              >
                <ArrowBigDown className={cn("w-5 h-5", currentVote === -1 && "fill-current")} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer group">
              <MessageSquare className="w-4 h-4" />
              <span className="text-[10px] font-bold">{post.comment_count}</span>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-primary transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
