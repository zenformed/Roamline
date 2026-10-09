import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const STORY_BATCH_SIZE = 12;

type StoryMedia = {
  id: string;
  kind: "photo" | "video";
  storage_path: string;
  thumbnail_storage_path: string | null;
  caption: string | null;
  place_name: string | null;
  captured_at: string | null;
  created_at: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const requestedOffset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
  const offset = Number.isSafeInteger(requestedOffset)
    ? Math.max(0, requestedOffset)
    : 0;
  const supabase = await createClient();
  const [{ data: trip, error: tripError }, { data: userData }] = await Promise.all([
    supabase
      .from("trips")
      .select("id,owner_id,visibility")
      .eq("slug", slug)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);

  if (tripError || !trip) {
    return NextResponse.json({ error: "Journey not found." }, { status: 404 });
  }

  if (trip.visibility === "private" && trip.owner_id !== userData.user?.id) {
    if (!userData.user) {
      return NextResponse.json({ error: "Journey not found." }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", trip.id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Journey not found." }, { status: 404 });
    }
  }

  const { data, error, count } = await supabase
    .from("media")
    .select(
      "id,kind,storage_path,thumbnail_storage_path,caption,place_name,captured_at,created_at",
      { count: "exact" }
    )
    .eq("trip_id", trip.id)
    .order("captured_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + STORY_BATCH_SIZE - 1);

  if (error) {
    return NextResponse.json(
      { error: "Journey moments could not be loaded." },
      { status: 500 }
    );
  }

  const media = (data ?? []) as StoryMedia[];
  const paths = media.map((item) =>
    item.kind === "photo"
      ? item.thumbnail_storage_path ?? item.storage_path
      : item.storage_path
  );
  const { data: signed, error: signingError } = paths.length
    ? await supabase.storage.from("trip-media").createSignedUrls(paths, 3600)
    : { data: [], error: null };

  if (signingError) {
    return NextResponse.json(
      { error: "Journey photos could not be loaded." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    moments: media.flatMap((item, index) => {
      const url = signed?.[index]?.signedUrl;
      return url
        ? [{
            id: item.id,
            url,
            kind: item.kind,
            caption: item.caption,
            placeName: item.place_name,
            capturedAt: item.captured_at ?? item.created_at,
          }]
        : [];
    }),
    total: count ?? 0,
    nextOffset:
      offset + media.length < (count ?? 0) ? offset + media.length : null,
  });
}
