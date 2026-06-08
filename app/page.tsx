import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { roleRedirectPath } from "@/lib/routes";
import { RootEntry } from "@/components/root-entry";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return (
      <RootEntry
        destination="/login"
        heading="Welcome to Himalaya Paints"
        subtitle="You are not signed in yet. We’ll take you to the login page now."
        ctaLabel="Go to Login"
      />
    );
  }

  const payload = await verifyToken(token).catch(() => null);
  if (!payload) {
    return (
      <RootEntry
        destination="/login"
        heading="Session expired"
        subtitle="Your login session is no longer valid. We’ll take you back to sign in."
        ctaLabel="Go to Login"
      />
    );
  }

  const destination = roleRedirectPath(payload.role);
  return (
    <RootEntry
      destination={destination}
      heading="Opening your dashboard"
      subtitle="We’re taking you to the correct dashboard now. If it does not happen automatically, use the button below."
      ctaLabel="Continue"
    />
  );
}
