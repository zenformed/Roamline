"use server";

import { revalidatePath } from "next/cache";

export async function refreshTrip(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
  revalidatePath(`/trip/${slug}`);
  revalidatePath("/");
}
