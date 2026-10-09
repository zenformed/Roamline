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
  const day = request.nextUrl.searchParams.get("day") ?? "";
  const requestedOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const offset = Number.isSafeInteger(requestedOffset) ? Math.max(0, requestedOffset) : 0;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return NextResponse.json({ error: "Choose a valid day." }, { status: 400 });
  }

  const start = new Date(`${day}T00:00:00.000Z`).toISOString();
  const endDate = new Date(`${day}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString();
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

  const { data, error } = await supabase
    .from("media")
    .select("id,uploader_id,kind,storage_path,thumbnail_storage_path,caption,captured_at,place_name,latitude,longitude")
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
