import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Label, Subtitle, Title } from "@/components/ui";
import { toast } from "sonner";
import { apiFetch } from "@/services/api-client";
import { useAuthSessionContext } from "@/components/providers";
import { roleRedirectPath } from "@/lib/routes";
import { SiteFooter } from "@/components/site-footer";
export function LoginPage() {
    const navigate = useNavigate();
    const authSession = useAuthSessionContext();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        try {
            const data = await apiFetch("/api/auth/login", {
                method: "POST",
                json: { email, password }
            });
            toast.success("Welcome back");
            await authSession?.refreshSession?.();
            navigate(roleRedirectPath(data.role), { replace: true });
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Login failed");
        }
        finally {
            setLoading(false);
        }
    }
    return (<div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_26%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)]">
      <main className="flex flex-1 items-start px-3 py-6 sm:items-center sm:px-4 sm:py-8 lg:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center gap-6 sm:gap-8">
          <Card className="w-full max-w-full overflow-hidden sm:max-w-md">
            <CardHeader className="space-y-1">
              <Title className="text-xl sm:text-2xl">Sign in</Title>
              <Subtitle className="text-sm sm:text-base">Use your assigned account details to access production history.</Subtitle>
            </CardHeader>
            <CardBody className="p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email"/>
                </div>
                <div>
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="pr-14"/>
                    <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-slate-500 transition hover:text-ink" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4"/>}
                  Sign in
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </div>);
}
