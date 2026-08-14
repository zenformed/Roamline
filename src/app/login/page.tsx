import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const mode = params.mode === "signup" ? "signup" : "login";
  const returnTo =
    typeof params.returnTo === "string" && params.returnTo.startsWith("/")
      ? params.returnTo
      : "/";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    redirect(returnTo);
  }

  return (
    <main className="auth-page">
      <div className="auth-top"><Link className="brand auth-brand" href="/">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        Roamline
      </Link><ThemeToggle /></div>
      <section className="auth-panel">
        <p className="journey-overline">{mode === "signup" ? "JOIN THE JOURNEY" : "WELCOME BACK"}</p>
        <h1>{mode === "signup" ? "Create your account" : "Sign in to Roamline"}</h1>
        <p>{mode === "signup" ? "Create trips and share the road with your favorite people." : "Your trips, moments, and people are waiting."}</p>
        <AuthForm mode={mode} returnTo={returnTo} />
      </section>
      <p className="auth-footnote">A quiet place for the journeys worth sharing.</p>
    </main>
  );
}
