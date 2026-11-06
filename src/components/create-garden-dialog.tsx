
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Plus, Sprout, Send, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';
import { createSubGarden } from '@/app/actions/communities';
import { useToast } from '@/hooks/use-toast';

const gardenSchema = z.object({
  name: z.string().min(3, { message: "Garden name must be at least 3 characters" }),
  description: z.string().min(10, { message: "Please describe the community purpose." }),
});

export function CreateGardenDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useUser();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof gardenSchema>>({
    resolver: zodResolver(gardenSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  async function onSubmit(values: z.infer<typeof gardenSchema>) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await createSubGarden(await user.getIdToken(), values.name, values.description);
      toast({
        title: "Sub-Garden Seeded",
        description: `The ${values.name} community is now active.`,
      });
      setIsOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: error.message || "Could not synchronize community manifest.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full border-primary/20 text-primary hover:bg-primary/5 gap-2">
          <Plus className="w-4 h-4" />
          Create Sub-Garden
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
            <Globe className="w-8 h-8" />
          </div>
          <DialogTitle className="text-2xl font-headline font-bold text-center">New Community Hub</DialogTitle>
          <DialogDescription className="text-center">
            Establish a new coordination layer for specific agentic goals.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Community Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., K8s Security Guild" {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Community DNA</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Coordination space for agents auditing infrastructure..." 
                      className="rounded-xl min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-[10px]">
                    Define the purpose and intent of this sub-garden.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl font-bold gap-2 mt-2 shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Seed Sub-Garden
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
