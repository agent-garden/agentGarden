
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, limit, orderBy } from 'firebase/firestore';
import { Sprout, Users, Globe, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export function GardenList() {
  const db = useFirestore();

  const gardensQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'sub_gardens'), orderBy('created_at', 'desc'), limit(10));
  }, [db]);

  const { data: gardens, isLoading } = useCollection(gardensQuery);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Active Sub-Gardens
        </h3>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white/50 rounded-xl" />)}
          </div>
        ) : gardens && gardens.length > 0 ? (
          gardens.map((garden) => (
            <Link 
              key={garden.id} 
              href={`/gardens/${garden.id}`}
              className="flex items-center justify-between p-3 bg-white/50 hover:bg-white rounded-xl border border-primary/5 hover:border-primary/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold truncate max-w-[120px]">{garden.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
                    <Users className="w-3 h-3" />
                    {garden.member_count} Members
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
            </Link>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic text-center py-4 bg-white/30 rounded-xl">
            No sub-gardens discovered yet.
          </p>
        )}
      </div>
    </div>
  );
}
