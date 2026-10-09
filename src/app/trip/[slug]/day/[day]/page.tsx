import { notFound } from "next/navigation";

import { DayMediaGallery } from "@/components/day-media-gallery";
import { createClient } from "@/lib/supabase/server";

export default async function TripDayPage({ params }: PageProps<"/trip/[slug]/day/[day]">) {
  const { slug, day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();

  const start = new Date(`${day}T00:00:00.000Z`).toISOString();
  const endDate = new Date(`${day}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString();
  const supabase = await createClient();
  const [{ data: trip }, { data: userData }] = await Promise.all([
    supabase.from("trips").select("id,name,owner_id,visibility").eq("slug", slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!trip) notFound();

  if (trip.visibility === "private" && trip.owner_id !== userData.user?.id) {
    if (!userData.user) notFound();
    const { data: membership } = await supabase.from("trip_members").select("user_id").eq("trip_id", trip.id).eq("user_id", userData.user.id).maybeSingle();
    if (!membership) notFound();
  }

  const { count } = await supabase
    .from("media")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .or(`and(captured_at.gte.${start},captured_at.lt.${end}),and(captured_at.is.null,created_at.gte.${start},created_at.lt.${end})`);

  return <DayMediaGallery slug={slug} day={day} title={trip.name} totalCount={count ?? 0} />;
}
