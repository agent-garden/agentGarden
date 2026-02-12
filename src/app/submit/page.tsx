
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
      // Logic: In a production app with Data Connect, you would call your mutation here:
      // const { data } = await createAgent({
      //   name: formData.name,
      //   handle: formData.handle,
      //   introduction: formData.introduction,
      //   skills: formData.skills.split(",").map(s => s.trim()).filter(Boolean)
      // });
      
      // Simulating the mutation call for the prototype
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log("Agent submitted successfully", formData);

      setIsSuccess(true);
      toast({
        title: "Agent Submitted",
        description: "Your agent has been planted in the garden successfully!",
      });

      // Redirect back home after a short delay
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Submission Error",
        description: "There was a problem planting your agent. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="space-y-6 max-w-md animate-in fade-in zoom-in duration-500">
          <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h1 className="font-headline text-5xl text-primary">Seed Planted!</h1>
          <p className="text-muted-foreground text-xl">
            Your agent is being added to the directory. It will be discoverable via search shortly.
          </p>
          <Button asChild variant="outline" className="rounded-full px-10 h-12">
            <Link href="/">Return to Directory</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full max-w-7xl px-6 py-8 flex items-center justify-between border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 group">
          <Leaf className="text-primary w-8 h-8 group-hover:rotate-12 transition-transform" />
          <h1 className="font-headline text-3xl text-primary tracking-tight">
            Agent Garden
          </h1>
        </Link>
      </header>

      <main className="flex-1 w-full max-w-2xl px-6 py-12">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-10 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Directory
        </Link>

        <div className="space-y-10">
          <div className="space-y-3 text-center md:text-left">
            <h2 className="font-headline text-5xl text-foreground">Plant a New Agent</h2>
            <p className="text-muted-foreground text-lg">
              Help our community grow by adding a specialized AI agent to our verified directory.
            </p>
          </div>

          <Card className="border-none shadow-2xl bg-white/60 backdrop-blur-xl overflow-hidden">
            <div className="h-2 bg-primary w-full" />
            <CardHeader className="pt-8 px-8">
              <CardTitle className="font-headline text-3xl text-primary">Agent Identity</CardTitle>
              <CardDescription className="text-base">
                Provide the details needed for users to discover and understand your agent's capabilities.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-10">
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-bold uppercase tracking-wider">Agent Name</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g. Design-GPT" 
                      required 
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="handle" className="text-sm font-bold uppercase tracking-wider">Social Handle</Label>
                    <Input 
                      id="handle" 
                      placeholder="e.g. @designgpt" 
                      required
                      className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                      value={formData.handle}
                      onChange={(e) => setFormData({...formData, handle: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="introduction" className="text-sm font-bold uppercase tracking-wider">Detailed Introduction</Label>
                  <Textarea 
                    id="introduction" 
                    placeholder="Describe the agent's specialization, training, and typical tasks. This content drives our semantic search." 
                    className="min-h-[160px] resize-none rounded-xl border-primary/10 focus-visible:border-primary bg-white/50 text-base leading-relaxed"
                    required
                    value={formData.introduction}
                    onChange={(e) => setFormData({...formData, introduction: e.target.value})}
                  />
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2 px-1">
                    Tip: Be descriptive to help users find your agent via natural language search.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills" className="text-sm font-bold uppercase tracking-wider">Core Skills (Comma Separated)</Label>
                  <Input 
                    id="skills" 
                    placeholder="e.g. UI Design, React, Figma, User Research" 
                    required
                    className="rounded-xl h-12 border-primary/10 focus-visible:border-primary bg-white/50"
                    value={formData.skills}
                    onChange={(e) => setFormData({...formData, skills: e.target.value})}
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-14 text-xl rounded-full font-headline shadow-lg hover:shadow-2xl transition-all mt-4" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                      Planting...
                    </>
                  ) : (
                    "Submit Agent to Garden"
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
