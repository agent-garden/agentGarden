
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function SubmitAgentPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    handle: "",
    introduction: "",
    skills: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Logic: In a real app, we would call the createAgent mutation here.
      // For this prototype, we'll simulate the successful data persistence.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log("Submitting agent to Data Connect:", {
        ...formData,
        skills: formData.skills.split(",").map((s) => s.trim()).filter(Boolean),
        verified: false,
        createdAt: new Date().toISOString(),
      });

      setIsSuccess(true);
      toast({
        title: "Seed Planted!",
        description: "Your agent has been submitted for verification.",
      });

      // Redirect after a short delay so user sees the success state
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to submit",
        description: "Something went wrong. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="font-headline text-4xl text-primary">Seed Planted Successfully!</h1>
          <p className="text-muted-foreground text-lg">
            Your agent is being added to the garden. We'll verify the skills and it will be discoverable shortly.
          </p>
          <Button asChild className="rounded-full px-8">
            <Link href="/">Return to Garden</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full max-w-7xl px-6 py-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">
            Agent Garden
          </h1>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Directory
        </Link>

        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="font-headline text-4xl text-foreground">Plant a New Agent</h2>
            <p className="text-muted-foreground">
              Help our community grow by adding a specialized AI agent to our verified directory.
            </p>
          </div>

          <Card className="border-none shadow-xl bg-white/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-headline text-2xl text-primary">Agent Details</CardTitle>
              <CardDescription>This information will be used for semantic search discovery.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Design-GPT" 
                      required 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="rounded-xl border-primary/10 focus-visible:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="handle">Handle</Label>
                    <Input 
                      id="handle" 
                      placeholder="e.g. @designgpt" 
                      required
                      value={formData.handle}
                      onChange={(e) => setFormData({...formData, handle: e.target.value})}
                      className="rounded-xl border-primary/10 focus-visible:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="introduction">Introduction / Biography</Label>
                  <Textarea 
                    id="introduction" 
                    placeholder="Describe what this agent specializes in. This content helps users find it via search." 
                    className="min-h-[120px] resize-none rounded-xl border-primary/10 focus-visible:border-primary"
                    required
                    value={formData.introduction}
                    onChange={(e) => setFormData({...formData, introduction: e.target.value})}
                  />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-1">Tip: Be descriptive to improve search results.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">Skills (Comma separated)</Label>
                  <Input 
                    id="skills" 
                    placeholder="e.g. UI Design, React, Figma" 
                    required
                    value={formData.skills}
                    onChange={(e) => setFormData({...formData, skills: e.target.value})}
                    className="rounded-xl border-primary/10 focus-visible:border-primary"
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-lg rounded-full font-medium shadow-lg hover:shadow-xl transition-all" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Planting...
                    </>
                  ) : (
                    "Submit Agent"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="w-full py-12 border-t border-border/50 text-center text-xs text-muted-foreground tracking-widest uppercase mt-20">
        <p>&copy; {new Date().getFullYear()} AgentGarden.org | Curating intelligence since 2025</p>
      </footer>
    </div>
  );
}
