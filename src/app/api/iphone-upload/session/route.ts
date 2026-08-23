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
  const { data: uploadSession, error } = await supabase.from("iphone_upload_sessions").insert({
    token_hash: tokenHash,
    user_id: user.id,
    trip_id: body.tripId,
  }).select("id").single();
  if (error) return Response.json({ error: error.message }, { status: 403 });

  // URLSearchParams serializes spaces as "+", but the Shortcuts URL scheme
  // treats that as a literal character in the shortcut name. Encode it with
  // percent escapes so iOS finds "Upload to Roamline" correctly.
  const launchUrl = `shortcuts://run-shortcut?name=${encodeURIComponent(SHORTCUT_NAME)}&input=text&text=${encodeURIComponent(token)}`;

  return Response.json({ launchUrl, sessionId: uploadSession.id, expiresInMinutes: 45 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get("id");
  if (!sessionId) return Response.json({ error: "An upload session is required." }, { status: 400 });
  const { data, error } = await supabase.from("iphone_upload_sessions").select("id,trip_id,uploaded_files,completed_at,expires_at").eq("id", sessionId).eq("user_id", user.id).maybeSingle();
  if (error || !data) return Response.json({ error: "Upload session not found." }, { status: 404 });
  return Response.json({ tripId: data.trip_id, uploadedFiles: data.uploaded_files, complete: Boolean(data.completed_at), expired: new Date(data.expires_at).getTime() <= Date.now() });
}
