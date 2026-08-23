import { createHash, randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

const SHORTCUT_NAME = "Upload to Roamline";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Please sign in again." }, { status: 401 });

  let body: { tripId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The upload request was invalid." }, { status: 400 });
  }
  if (!body.tripId) return Response.json({ error: "A trip is required." }, { status: 400 });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("iphone_upload_sessions").insert({
    token_hash: tokenHash,
    user_id: user.id,
    trip_id: body.tripId,
  });
  if (error) return Response.json({ error: error.message }, { status: 403 });

  // URLSearchParams serializes spaces as "+", but the Shortcuts URL scheme
  // treats that as a literal character in the shortcut name. Encode it with
  // percent escapes so iOS finds "Upload to Roamline" correctly.
  const launchUrl = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(token)}`;

  return Response.json({ launchUrl, expiresInMinutes: 45 });
}
