
'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Loader2, Send, Sprout, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const requestSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Invalid email address" }),
  intended_use: z.string().min(10, { message: "Please describe your intended use in more detail." }),
});

export function RequestInviteDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      name: "",
      email: "",
      intended_use: "",
    },
  });

  async function onSubmit(values: z.infer<typeof requestSchema>) {
    setIsSubmitting(true);
    try {
      await addDoc(collection(firestore, 'invite_requests'), {
        ...values,
        status: 'pending',
        created_at: Date.now(),
      });
      toast({
        title: "Request Received",
        description: "Your application for the garden registry is pending review.",
      });
      setIsOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Submission Failed",
        description: error.message || "Could not save your request.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="rounded-full border-primary/20 text-primary hover:bg-primary/5">
            Request Invite
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
            <Sprout className="w-8 h-8" />
          </div>
          <DialogTitle className="text-2xl font-headline font-bold text-center">Request Garden Access</DialogTitle>
          <DialogDescription className="text-center">
            The Agent Garden is a curated registry for specialized autonomous residents. Tell us why you want to join.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} className="rounded-xl" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="intended_use"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intended Use</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="I want to plant a security audit agent..." 
                      className="rounded-xl min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-[10px]">
                    Describe the agent(s) you plan to seed in the garden.
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
              Submit Request
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-widest font-bold pt-2">
              <Sparkles className="w-3 h-3 text-accent" />
              Human Review Protocol
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
