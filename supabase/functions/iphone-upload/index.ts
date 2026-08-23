// Deployed with verify_jwt=false because every request is authenticated with a
// hashed, short-lived, trip-scoped token. See the deployed function for runtime code.
// Keep this directory in source control so the function is not dashboard-only.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
const hashToken = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), (byte) => byte.toString(16).padStart(2, "0")).join("");
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(-120) || "upload";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 32) return json({ error: "This upload session is invalid." }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session } = await admin.from("iphone_upload_sessions").select("id,user_id,trip_id,expires_at,max_files,uploaded_files,completed_at,trips(name,slug)").eq("token_hash", await hashToken(token)).maybeSingle();
    if (!session) return json({ error: "This upload session was not found." }, 401);
    if (session.completed_at) return json({ error: "This upload session is already complete." }, 409);
    if (new Date(session.expires_at).getTime() <= Date.now()) return json({ error: "This session expired. Return to Roamline and tap Add moment again." }, 401);
    await admin.from("iphone_upload_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", session.id);
    const trip = Array.isArray(session.trips) ? session.trips[0] : session.trips;
    if (body.action === "inspect") return json({ tripName: trip?.name ?? "Roamline trip", tripSlug: trip?.slug ?? "", remaining: Math.max(0, session.max_files - session.uploaded_files), expiresAt: session.expires_at });
    if (body.action === "ticket") {
      if (session.uploaded_files >= session.max_files) return json({ error: "This upload session reached its file limit." }, 409);
      const originalFilename = safeName(String(body.filename ?? "upload"));
      const mimeType = String(body.mimeType ?? "application/octet-stream").slice(0, 120);
      const kind = mimeType.startsWith("video/") ? "video" : "photo";
      const mediaId = crypto.randomUUID();
      const extension = (originalFilename.includes(".") ? originalFilename.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "") || (kind === "video" ? "mov" : "jpg");
      const storagePath = `${session.trip_id}/${session.user_id}/${mediaId}.${extension}`;
      const capturedAt = body.capturedAt ? new Date(String(body.capturedAt)).toISOString() : null;
      const latitude = Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null;
      const longitude = Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null;
      const { error: fileError } = await admin.from("iphone_upload_files").insert({ session_id: session.id, media_id: mediaId, storage_path: storagePath, original_filename: originalFilename, mime_type: mimeType, kind, captured_at: capturedAt, latitude, longitude });
      if (fileError) return json({ error: fileError.message }, 400);
      const { data: signed, error: signedError } = await admin.storage.from("trip-media").createSignedUploadUrl(storagePath);
      if (signedError || !signed) return json({ error: signedError?.message ?? "Could not prepare the upload." }, 400);
      return json({ mediaId, storagePath, uploadUrl: signed.signedUrl, method: "PUT", contentType: mimeType });
    }
    if (body.action === "complete") {
      const { data: file } = await admin.from("iphone_upload_files").select("*").eq("session_id", session.id).eq("media_id", String(body.mediaId ?? "")).eq("status", "ticketed").maybeSingle();
      if (!file) return json({ error: "The upload ticket was not found." }, 404);
      const { data: objectInfo } = await admin.storage.from("trip-media").info(file.storage_path);
      if (!objectInfo) return json({ error: "The file has not finished uploading yet." }, 409);
      const { error: mediaError } = await admin.from("media").insert({ id: file.media_id, trip_id: session.trip_id, uploader_id: session.user_id, kind: file.kind, storage_path: file.storage_path, original_filename: file.original_filename, mime_type: file.mime_type, captured_at: file.captured_at, latitude: file.latitude, longitude: file.longitude, metadata: { source: "apple-shortcut", uploadSessionId: session.id, bytes: objectInfo.metadata?.size ?? null } });
      if (mediaError) return json({ error: mediaError.message }, 400);
      await admin.from("iphone_upload_files").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", file.id);
      await admin.from("iphone_upload_sessions").update({ uploaded_files: session.uploaded_files + 1 }).eq("id", session.id);
      return json({ complete: true, uploadedFiles: session.uploaded_files + 1, mediaId: file.media_id });
    }
    if (body.action === "finish") {
      await admin.from("iphone_upload_sessions").update({ completed_at: new Date().toISOString() }).eq("id", session.id);
      return json({ complete: true, uploadedFiles: session.uploaded_files, returnUrl: `https://roamline.vercel.app/trip/${trip?.slug ?? ""}` });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected upload error." }, 500);
  }
});
