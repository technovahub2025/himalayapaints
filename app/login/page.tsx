"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Label, Subtitle, Title } from "@/components/ui";
import { roleRedirectPath } from "@/lib/routes";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      toast.success("Welcome back");
      router.push(roleRedirectPath(data.role));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_26%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="text-ink">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-4 py-2 text-sm shadow-soft backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Role based production dashboard
          </div>
          <h1 className="mt-6 max-w-2xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Clean operations for admin and user workflows.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Enter master items, calculate quantities and amounts in real time, and let users work from live
            production ratios without editing admin data.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">Admin</p>
                    <p className="text-sm text-muted">Create and manage item master data</p>
                  </div>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accentSoft text-accent">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">User</p>
                    <p className="text-sm text-muted">View live percentages and production outputs</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </section>

        <Card className="overflow-hidden">
          <CardHeader>
            <Title>Sign in</Title>
            <Subtitle>Use the seeded demo accounts or connect your own auth data.</Subtitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              </div>
              <div>
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                Sign in
              </Button>
              <div className="grid gap-3 rounded-3xl border border-line bg-slate-50 p-4 text-sm text-muted">
                <p className="font-medium text-ink">Demo accounts</p>
                <p>Admin: admin@example.com / Password123!</p>
                <p>User: user@example.com / Password123!</p>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
