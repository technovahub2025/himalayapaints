import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Input, Label, Subtitle, Title } from "@/components/ui";
import { toast } from "sonner";
import { apiFetch, setAuthToken } from "@/services/api-client";
function roleRedirectPath(role) {
    return role === "admin" ? "/admin" : "/user";
}
export function LoginPage() {
    const navigate = useNavigate();
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
            if (data.token) {
                setAuthToken(data.token);
            }
            toast.success("Welcome back");
            navigate(roleRedirectPath(data.role), { replace: true });
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Login failed");
        }
        finally {
            setLoading(false);
        }
    }
    return (<main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.16),_transparent_26%),linear-gradient(180deg,#f8f4ec_0%,#f3efe6_100%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center gap-8">
        <Card className="w-full max-w-md overflow-hidden">
          <CardHeader>
            <Title>Sign in</Title>
            <Subtitle>Use your assigned account details to access the dashboard.</Subtitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-5">
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
    </main>);
}
