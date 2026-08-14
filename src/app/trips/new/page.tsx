import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { TripForm } from "@/components/trip-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewTripPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login?mode=signup&returnTo=/trips/new");

  return (
    <main className="form-page">
      <SiteHeader />
      <section className="form-shell">
        <Link className="back-link" href="/"><ArrowLeft size={15} /> Back to trips</Link>
        <p className="journey-overline">NEW JOURNEY</p>
        <h1>Where are you headed?</h1>
        <p className="form-intro">Start with the basics. You can add people, photos, and check-ins once the trip exists.</p>
        <TripForm />
      </section>
    </main>
  );
}
