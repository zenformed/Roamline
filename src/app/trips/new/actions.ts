"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type TripFormState = { error?: string };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createTrip(
  _previousState: TripFormState,
  formData: FormData,
): Promise<TripFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const description = String(formData.get("description") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const visibility = String(formData.get("visibility") ?? "unlisted");

  if (name.length < 1 || name.length > 120) return { error: "Trip name must be between 1 and 120 characters." };
  if (!slugPattern.test(slug)) return { error: "Use lowercase letters, numbers, and single hyphens in the URL." };
  if (description.length > 1200) return { error: "Description must be 1,200 characters or fewer." };
  if (startDate && endDate && endDate < startDate) return { error: "End date cannot be before the start date." };
  if (!["public", "unlisted", "private"].includes(visibility)) return { error: "Choose a valid visibility." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) redirect(`/login?returnTo=${encodeURIComponent("/trips/new")}`);

  const fallbackName = user.email ? user.email.split("@")[0] : "Traveler";
  const { error: profileError } = await supabase.from("profiles").upsert(
    { id: user.id, display_name: fallbackName },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (profileError) return { error: "Your profile could not be prepared. Please try again." };

  const { error } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      name,
      slug,
      description: description || null,
      start_date: startDate || null,
      end_date: endDate || null,
      visibility,
      status: "published",
      published_at: new Date().toISOString(),
    });

  if (error?.code === "23505") return { error: "That trip URL is already in use. Try another." };
  if (error) {
    if (process.env.NODE_ENV !== "production") console.error("createTrip failed", error);
    return { error: process.env.NODE_ENV === "development" && error ? `The trip could not be created: ${error.message}` : "The trip could not be created. Please try again." };
  }

  revalidatePath("/");
  redirect(`/trip/${slug}`);
}
