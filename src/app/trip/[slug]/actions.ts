"use server";

import { revalidatePath } from "next/cache";
import webpush from "web-push";

import { createClient } from "@/lib/supabase/server";

export async function refreshTrip(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
  revalidatePath(`/trip/${slug}`);
  revalidatePath("/");
}

type TripUpdateKind = "checkin" | "media";
type PushRecipient = { endpoint: string; p256dh: string; auth: string };

export async function notifyTripFollowers(tripId: string, kind: TripUpdateKind, count = 1) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tripId)) return { sent: 0 };
  if (kind !== "checkin" && kind !== "media") return { sent: 0 };
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return { sent: 0, unavailable: true };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { sent: 0 };
  const [{ data: trip }, { data: recipients, error }] = await Promise.all([
    supabase.from("trips").select("name,slug").eq("id", tripId).maybeSingle(),
    supabase.rpc("trip_push_recipients", { target_trip_id: tripId }),
  ]);
  if (!trip || error || !recipients?.length) return { sent: 0 };

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://roamline.vercel.app", publicKey, privateKey);
  const amount = Math.max(1, Math.min(100, Math.round(count)));
  const body = kind === "checkin"
    ? `${trip.name} added a new check-in.`
    : `${trip.name} added ${amount === 1 ? "a new moment" : `${amount} new moments`}.`;
  const payload = JSON.stringify({ title: trip.name, body, url: `/trip/${trip.slug}`, tag: `trip-${tripId}` });
  const typedRecipients = recipients as PushRecipient[];
  const results = await Promise.allSettled(typedRecipients.map((recipient) => webpush.sendNotification({ endpoint: recipient.endpoint, keys: { p256dh: recipient.p256dh, auth: recipient.auth } }, payload, { TTL: 60 * 60 * 24 })));
  const expiredEndpoints = results.flatMap((result, index) => result.status === "rejected" && [404, 410].includes(Number((result.reason as { statusCode?: number })?.statusCode)) ? [typedRecipients[index].endpoint] : []);
  if (expiredEndpoints.length) await supabase.rpc("remove_invalid_push_subscriptions", { subscription_endpoints: expiredEndpoints });
  return { sent: results.filter((result) => result.status === "fulfilled").length };
}
