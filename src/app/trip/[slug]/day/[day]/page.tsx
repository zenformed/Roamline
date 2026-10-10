import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { DayMediaGallery } from "@/components/day-media-gallery";
import { createClient } from "@/lib/supabase/server";
import {
  isDateKey,
  normalizeTimeZone,
  VIEWER_TIME_ZONE_COOKIE,
} from "@/lib/time-zone";

export default async function TripDayPage({ params }: PageProps<"/trip/[slug]/day/[day]">) {
  const { slug, day } = await params;
  if (!isDateKey(day)) notFound();
  const cookieStore = await cookies();
  const viewerTimeZone = normalizeTimeZone(
    cookieStore.get(VIEWER_TIME_ZONE_COOKIE)?.value
  );
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

  return <DayMediaGallery key={`${day}-${viewerTimeZone}`} slug={slug} day={day} title={trip.name} />;
}
