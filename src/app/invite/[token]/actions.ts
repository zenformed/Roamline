"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") || "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect(`/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`);
  const { data, error } = await supabase.rpc("accept_trip_invitation", { p_token: token });
  if (error || !data) return;
  redirect(`/trip/${data}`);
}
