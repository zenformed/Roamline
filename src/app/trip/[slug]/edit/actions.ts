"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TripFormState } from "@/app/trips/new/actions";
import { createClient } from "@/lib/supabase/server";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function updateTrip(_previousState: TripFormState, formData: FormData): Promise<TripFormState> {
  const tripId = String(formData.get("tripId") ?? "");
  const oldSlug = String(formData.get("oldSlug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const visibility = String(formData.get("visibility") ?? "private");
  if (!tripId) return { error: "The trip could not be identified." };
  if (name.length < 1 || name.length > 120) return { error: "Trip name must be between 1 and 120 characters." };
  if (!slugPattern.test(slug)) return { error: "Use lowercase letters, numbers, and single hyphens in the URL." };
  if (description.length > 1200) return { error: "Description must be 1,200 characters or fewer." };
  if (startDate && endDate && endDate < startDate) return { error: "End date cannot be before the start date." };
  if (!["public", "unlisted", "private"].includes(visibility)) return { error: "Choose a valid visibility." };
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/login?returnTo=${encodeURIComponent(`/trip/${oldSlug}/edit`)}`);
  const { data: trip } = await supabase.from("trips").select("owner_id").eq("id", tripId).maybeSingle();
  if (!trip || trip.owner_id !== userData.user.id) return { error: "Only the trip owner can change these settings." };
  const { error } = await supabase.from("trips").update({ name, slug, description: description || null, start_date: startDate || null, end_date: endDate || null, visibility }).eq("id", tripId).eq("owner_id", userData.user.id);
  if (error?.code === "23505") return { error: "That trip URL is already in use. Try another." };
  if (error) return { error: process.env.NODE_ENV === "development" ? `The trip could not be updated: ${error.message}` : "The trip could not be updated. Please try again." };
  revalidatePath("/"); revalidatePath(`/trip/${oldSlug}`); revalidatePath(`/trip/${slug}`);
  redirect(`/trip/${slug}`);
}
