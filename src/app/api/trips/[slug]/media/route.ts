import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const DAY_BATCH_SIZE = 20;

type DayMedia = {
  id: string;
  uploader_id: string;
  kind: "photo" | "video";
  storage_path: string;
  thumbnail_storage_path: string | null;
  caption: string | null;
  captured_at: string | null;
  place_name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const requestedStart = new Date(request.nextUrl.searchParams.get("start") ?? "");
  const requestedEnd = new Date(request.nextUrl.searchParams.get("end") ?? "");
  const requestedOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const offset = Number.isSafeInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;
  const rangeDuration = requestedEnd.getTime() - requestedStart.getTime();

  if (
    Number.isNaN(requestedStart.getTime()) ||
    Number.isNaN(requestedEnd.getTime()) ||
    rangeDuration <= 0 ||
    rangeDuration > 48 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: "Choose a valid day." }, { status: 400 });
  }

  const start = requestedStart.toISOString();
  const end = requestedEnd.toISOString();
  const supabase = await createClient();
  const [{ data: trip, error: tripError }, { data: userData }] = await Promise.all([
    supabase.from("trips").select("id,owner_id,visibility").eq("slug", slug).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (tripError || !trip) {
    return NextResponse.json({ error: "Journey not found." }, { status: 404 });
  }

  if (trip.visibility === "private" && trip.owner_id !== userData.user?.id) {
    if (!userData.user) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
    const { data: membership } = await supabase
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", trip.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
  }

  const { data, error, count } = await supabase
    .from("media")
    .select("id,uploader_id,kind,storage_path,thumbnail_storage_path,caption,captured_at,place_name,latitude,longitude", { count: "exact" })
    .eq("trip_id", trip.id)
    .or(`and(captured_at.gte.${start},captured_at.lt.${end}),and(captured_at.is.null,created_at.gte.${start},created_at.lt.${end})`)
    .order("captured_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + DAY_BATCH_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: "More moments could not be loaded." }, { status: 500 });
  }

  const media = (data ?? []) as DayMedia[];
  const paths = media.flatMap((item) => {
    const thumbnail = item.thumbnail_storage_path ?? item.storage_path;
    return item.kind === "video" ? [thumbnail, item.storage_path] : [thumbnail];
  });
  const uniquePaths = [...new Set(paths)];
  const { data: signed, error: signingError } = uniquePaths.length
    ? await supabase.storage.from("trip-media").createSignedUrls(uniquePaths, 3600)
    : { data: [], error: null };

  if (signingError) {
    return NextResponse.json({ error: "More moments could not be loaded." }, { status: 502 });
  }

  const urlByPath = new Map(uniquePaths.map((path, index) => [path, signed?.[index]?.signedUrl ?? null]));
  const mediaIds = media.map((item) => item.id);
  const { data: reactions } = mediaIds.length
    ? await supabase.from("reactions").select("media_id,emoji").in("media_id", mediaIds)
    : { data: [] };
  const reactionsByMedia = new Map<string, string[]>();
  for (const reaction of reactions ?? []) {
    reactionsByMedia.set(reaction.media_id, [...(reactionsByMedia.get(reaction.media_id) ?? []), reaction.emoji]);
  }

  return NextResponse.json({
    totalCount: count ?? 0,
    nextOffset: offset + media.length,
    items: media.flatMap((item) => {
      const thumbnailPath = item.thumbnail_storage_path ?? item.storage_path;
      const thumbnailUrl = urlByPath.get(thumbnailPath);
      const url = item.kind === "video" ? urlByPath.get(item.storage_path) : thumbnailUrl;
      return url && thumbnailUrl ? [{
        id: item.id,
        storagePath: item.storage_path,
        thumbnailStoragePath: item.thumbnail_storage_path,
        url,
        thumbnailUrl,
        caption: item.caption,
        kind: item.kind,
        capturedAt: item.captured_at,
        placeName: item.place_name,
        latitude: item.latitude,
        longitude: item.longitude,
        reactions: reactionsByMedia.get(item.id) ?? [],
        canManage: item.uploader_id === userData.user?.id,
      }] : [];
    }),
  });
}
