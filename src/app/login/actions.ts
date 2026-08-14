"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeReturnTo(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export async function authenticate(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const mode = formData.get("mode");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const returnTo = safeReturnTo(formData.get("returnTo"));

  if (!emailPattern.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();

  if (mode === "signup") {
    if (displayName.length < 1 || displayName.length > 80) {
      return { error: "Enter a name between 1 and 80 characters." };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Your account could not be created. Please try again." };
    }

    if (data.session) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        display_name: displayName,
      });
      if (profileError && profileError.code !== "23505") {
        return { error: "Your account was created, but the profile setup failed." };
      }

      revalidatePath("/", "layout");
      redirect(returnTo);
    }

    return { message: "Check your email to finish creating your account." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "The email or password is incorrect." };
  }

  revalidatePath("/", "layout");
  redirect(returnTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
