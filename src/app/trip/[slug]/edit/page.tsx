import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { DeleteTrip } from "@/components/delete-trip";
import { SiteHeader } from "@/components/site-header";
import { TripForm } from "@/components/trip-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditTripPage({ params }: PageProps<"/trip/[slug]/edit">) {
  const { slug } = await params;
  const supabase = await createClient();
  const [{ data: userData }, { data: trip }] = await Promise.all([supabase.auth.getUser(), supabase.from("trips").select("id,owner_id,name,slug,description,start_date,end_date,visibility").eq("slug", slug).maybeSingle()]);
  if (!trip) notFound();
  if (!userData.user) redirect(`/login?returnTo=${encodeURIComponent(`/trip/${slug}/edit`)}`);
  if (trip.owner_id !== userData.user.id) redirect(`/trip/${slug}`);
  const [{ data: memberData }, { data: invitationData }] = await Promise.all([
    supabase.from("trip_members").select("user_id").eq("trip_id", trip.id),
    supabase.from("trip_invitations").select("id,token,expires_at").eq("trip_id", trip.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
  ]);
  const collaboratorIds = (memberData ?? []).map((member) => member.user_id).filter((id) => id !== trip.owner_id);
  const { data: profileData } = collaboratorIds.length ? await supabase.from("profiles").select("id,display_name").in("id", collaboratorIds) : { data: [] };
  const collaborators = (profileData ?? []).map((profile) => ({ id: profile.id, displayName: profile.display_name }));
  const invitations = (invitationData ?? []).map((invitation) => ({ id: invitation.id, token: invitation.token, expiresAt: invitation.expires_at }));
  return <main className="form-page"><SiteHeader /><section className="form-shell"><Link className="back-link" href={`/trip/${slug}`}><ArrowLeft size={15} /> Back to journey</Link><p className="journey-overline">TRIP SETTINGS</p><h1>Edit your journey</h1><p className="form-intro">Change the trip details, dates, URL, collaborators, or who can see it.</p><TripForm mode="edit" ownerId={trip.owner_id} collaborators={collaborators} invitations={invitations} initialData={{ id: trip.id, name: trip.name, slug: trip.slug, description: trip.description ?? "", startDate: trip.start_date ?? "", endDate: trip.end_date ?? "", visibility: trip.visibility }} /><DeleteTrip tripId={trip.id} tripName={trip.name} ownerId={trip.owner_id} /></section></main>;
}
