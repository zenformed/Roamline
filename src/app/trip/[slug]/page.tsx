import Link from "next/link";
import { CalendarDays, MapPin, Pencil, Plus } from "lucide-react";
import { notFound } from "next/navigation";

import { AddMoment } from "@/components/add-moment";
import { CheckinCard } from "@/components/checkin-card";
import { DaySummary } from "@/components/day-summary";
import { FollowTrip } from "@/components/follow-trip";
import { HeaderNavigation } from "@/components/header-navigation";
import { JourneyMap } from "@/components/journey-map";
import { MediaGallery } from "@/components/media-gallery";
import { MediaSelectionProvider } from "@/components/media-selection";
import { TripStory } from "@/components/trip-story";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/server";

type Trip = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  visibility: string;
};

type Checkin = {
  id: string;
  author_id: string;
  place_id: string | null;
  place_name: string;
  formatted_address: string | null;
  note: string | null;
  occurred_at: string;
  latitude: number;
  longitude: number;
};

type Media = {
  id: string;
  uploader_id: string;
  storage_path: string;
  thumbnail_storage_path: string | null;
  caption: string | null;
  kind: "photo" | "video";
  captured_at: string | null;
  created_at: string;
  place_name: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Reaction = { media_id: string; emoji: string };
type Traveler = { id: string; display_name: string };
type Invitation = { id: string; token: string; expires_at: string };
type DaySummaryRecord = {
  id: string;
  summary_date: string;
  author_id: string;
  body: string;
  created_at: string;
  occurred_at: string;
  profiles: { display_name: string }[];
};
type CheckinAttendee = { checkin_id: string; user_id: string };

const AVATAR_COLORS = [
  "#dce8ff",
  "#ffe0da",
  "#dff1e5",
  "#eee1ff",
  "#fff0c7",
  "#d9eef2",
  "#f3ddea",
  "#e7e5d5",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "T"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

function travelerColors(travelers: Traveler[]) {
  const used = new Set<string>();
  return travelers.map((traveler) => {
    let index =
      [...traveler.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      AVATAR_COLORS.length;

    let color = AVATAR_COLORS[index];

    while (used.has(color) && used.size < AVATAR_COLORS.length) {
      index = (index + 1) % AVATAR_COLORS.length;
      color = AVATAR_COLORS[index];
    }

    used.add(color);
    return color;
  });
}

function tripDates(start: string | null, end: string | null) {
  if (!start && !end) return "Dates open";
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (start && end) {
    return `${formatter.format(new Date(`${start}T12:00:00`))} – ${formatter.format(new Date(`${end}T12:00:00`))}`;
  }

  return formatter.format(new Date(`${start ?? end}T12:00:00`));
}

function timelineDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

function mediaDateValue(item: { captured_at: string | null; created_at: string | null }) {
  const raw = item.captured_at ?? item.created_at ?? "";
  if (!raw) return new Date(0);

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export async function generateMetadata({ params }: PageProps<"/trip/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select("name,description")
    .eq("slug", slug)
    .maybeSingle();

  return {
    title: data ? `${data.name} — Roamline` : "Trip not found — Roamline",
    description: data?.description ?? "Follow the journey on Roamline.",
  };
}

export default async function TripPage({ params }: PageProps<"/trip/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tripData } = await supabase
    .from("trips")
    .select(
      "id,owner_id,name,slug,description,start_date,end_date,status,visibility"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!tripData) notFound();

  const trip = tripData as Trip;

  const [
    { data: checkinData },
    { data: mediaData },
    { data: memberData },
    { data: userData },
    { data: reactionData },
    { data: summaryData },
  ] = await Promise.all([
    supabase
      .from("checkins")
      .select(
        "id,author_id,place_id,place_name,formatted_address,note,occurred_at,latitude,longitude"
      )
      .eq("trip_id", trip.id)
      .order("occurred_at", { ascending: false }),

    supabase
      .from("media")
      .select(
        "id,uploader_id,storage_path,thumbnail_storage_path,caption,kind,captured_at,created_at,place_name,latitude,longitude"
      )
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: false }),

    supabase.from("trip_members").select("user_id").eq("trip_id", trip.id),

    supabase.auth.getUser(),

    supabase.from("reactions").select("media_id,emoji"),

    supabase
      .from("day_summaries")
      .select(
        "id,summary_date,author_id,body,created_at,occurred_at,profiles!day_summaries_author_id_fkey(display_name)"
      )
      .eq("trip_id", trip.id)
      .order("occurred_at", { ascending: false }),
  ]);

  const checkins = (checkinData ?? []) as Checkin[];

  const { data: attendeeData } = checkins.length
    ? await supabase
        .from("checkin_attendees")
        .select("checkin_id,user_id")
        .in(
          "checkin_id",
          checkins.map((checkin) => checkin.id)
        )
    : { data: [] };

  const media = (mediaData ?? []) as Media[];

  const mediaPaths = [
    ...new Set(
      media.flatMap((item) =>
        [item.storage_path, item.thumbnail_storage_path].filter(
          (path): path is string => Boolean(path)
        )
      )
    ),
  ];

  const signedMedia = mediaPaths.length
    ? await supabase.storage.from("trip-media").createSignedUrls(mediaPaths, 3600)
    : { data: [] };

  const mediaUrlByPath = new Map(
    mediaPaths.map((path, index) => [
      path,
      signedMedia.data?.[index]?.signedUrl ?? null,
    ])
  );

  const mediaWithUrls = media.map((item) => ({
    ...item,
    url: mediaUrlByPath.get(item.storage_path) ?? null,
    thumbnailUrl:
      mediaUrlByPath.get(item.thumbnail_storage_path ?? item.storage_path) ??
      null,
  }));

  const reactionsByMedia = new Map<string, string[]>();
  for (const reaction of (reactionData ?? []) as Reaction[]) {
    reactionsByMedia.set(reaction.media_id, [
      ...(reactionsByMedia.get(reaction.media_id) ?? []),
      reaction.emoji,
    ]);
  }

  const travelerIds = [
    ...new Set([trip.owner_id, ...(memberData ?? []).map((member) => member.user_id)]),
  ];

  const { data: travelerData } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", travelerIds);

  const travelers = (travelerData ?? []) as Traveler[];
  const avatarColors = travelerColors(travelers);
  const travelerById = new Map(travelers.map((traveler) => [traveler.id, traveler]));
  const avatarColorById = new Map(
    travelers.map((traveler, index) => [traveler.id, avatarColors[index]])
  );

  const attendeesByCheckin = new Map<string, string[]>();
  for (const attendee of (attendeeData ?? []) as CheckinAttendee[]) {
    attendeesByCheckin.set(attendee.checkin_id, [
      ...(attendeesByCheckin.get(attendee.checkin_id) ?? []),
      attendee.user_id,
    ]);
  }

  const canContribute = Boolean(
    userData.user &&
      (trip.owner_id === userData.user.id ||
        memberData?.some((member) => member.user_id === userData.user.id))
  );

  const summariesByDate = new Map<string, DaySummaryRecord[]>();
  for (const summary of (summaryData ?? []) as DaySummaryRecord[]) {
    summariesByDate.set(summary.summary_date, [
      ...(summariesByDate.get(summary.summary_date) ?? []),
      summary,
    ]);
  }

  const dayMap = new Map<
    string,
    { date: Date; checkins: Checkin[]; media: typeof mediaWithUrls }
  >();

  for (const checkin of checkins) {
    const date = new Date(checkin.occurred_at);
    const key = timelineDateKey(date);
    const day = dayMap.get(key) ?? { date, checkins: [], media: [] };
    day.checkins.push(checkin);
    dayMap.set(key, day);
  }

  for (const item of mediaWithUrls) {
    const date = mediaDateValue(item);
    const key = timelineDateKey(date);
    const day = dayMap.get(key) ?? { date, checkins: [], media: [] };
    day.media.push(item);
    dayMap.set(key, day);
  }

  for (const [summaryDate] of summariesByDate) {
    if (!dayMap.has(summaryDate)) {
      dayMap.set(summaryDate, {
        date: new Date(`${summaryDate}T12:00:00`),
        checkins: [],
        media: [],
      });
    }
  }

  const timelineDays = [...dayMap.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );

  const userId = userData.user?.id ?? null;

  const { data: followData } =
    userId && userId !== trip.owner_id
      ? await supabase
          .from("trip_follows")
          .select("notifications_enabled")
          .eq("trip_id", trip.id)
          .eq("user_id", userId)
          .maybeSingle()
      : { data: null };

  const { data: invitationData } =
    userId === trip.owner_id
      ? await supabase
          .from("trip_invitations")
          .select("id,token,expires_at")
          .eq("trip_id", trip.id)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : { data: [] };

  const collaborators = travelers
    .filter((traveler) => traveler.id !== trip.owner_id)
    .map((traveler) => ({
      id: traveler.id,
      displayName: traveler.display_name,
    }));

  const invitations = ((invitationData ?? []) as Invitation[]).map(
    (invitation) => ({
      id: invitation.id,
      token: invitation.token,
      expiresAt: invitation.expires_at,
    })
  );

  const normalizedMediaItems = mediaWithUrls
    .filter((item): item is typeof item & { url: string } => Boolean(item.url))
    .map((item) => ({
      id: item.id,
      storagePath: item.storage_path,
      thumbnailStoragePath: item.thumbnail_storage_path,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl ?? item.url,
      caption: item.caption,
      kind: item.kind,
      capturedAt: item.captured_at,
      placeName: item.place_name,
      latitude: item.latitude,
      longitude: item.longitude,
      uploaderId: item.uploader_id,
      canManage: Boolean(userId && userId === item.uploader_id),
      reactions: reactionsByMedia.get(item.id) ?? [],
    }));

  const storyMoments = normalizedMediaItems
    .slice()
    .sort(
      (a, b) =>
        mediaDateValue({
          captured_at: a.capturedAt,
          created_at: null,
        }).getTime() -
        mediaDateValue({
          captured_at: b.capturedAt,
          created_at: null,
        }).getTime()
    )
    .map((moment) => ({
      id: moment.id,
      url: moment.url,
      kind: moment.kind,
      caption: moment.caption,
      placeName: moment.placeName,
      capturedAt: moment.capturedAt,
    }));

  return (
    <main className="journey-page">
      <header className="site-header journey-header">
        <Link className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Roamline
        </Link>

        <nav className="header-nav">
          <HeaderNavigation
            signedIn={Boolean(userId)}
            displayName={userId ? travelerById.get(userId)?.display_name ?? null : null}
          />
          <ThemeToggle />
        </nav>
      </header>

      <section className="journey-intro page-shell">
        <div>
          <p className="journey-overline">
            {trip.status === "published" ? "SHARED JOURNEY" : trip.status.toUpperCase()}
          </p>

          <div className="journey-title-row">
            <h1>{trip.name}</h1>

            {userId === trip.owner_id ? (
              <Link className="inline-edit-link" href={`/trip/${trip.slug}/edit`}>
                <Pencil size={16} /> Edit
              </Link>
            ) : null}
          </div>

          {trip.description ? (
            <p className="journey-description">{trip.description}</p>
          ) : null}

          <div className="journey-meta">
            <span>
              <CalendarDays size={16} />
              {tripDates(trip.start_date, trip.end_date)}
            </span>

            {trip.visibility === "private" ? (
              <span>
                <MapPin size={16} />
                Private trip
              </span>
            ) : (
              <span>
                <MapPin size={16} />
                Shared trip
              </span>
            )}
          </div>
        </div>

        <div className="journey-actions">
          {userId && userId !== trip.owner_id ? (
            <FollowTrip
              tripId={trip.id}
              slug={trip.slug}
              signedIn={Boolean(userId)}
              initialFollowing={Boolean(followData)}
              initialNotifications={Boolean(followData?.notifications_enabled)}
            />
          ) : null}

          {userId === trip.owner_id ? (
            <Link className="ghost-button" href={`/trip/${trip.slug}/edit`}>
              <Plus size={16} /> Invite travelers
            </Link>
          ) : null}
        </div>
      </section>

      <JourneyMap
        points={checkins.map((checkin) => ({
          id: checkin.id,
          name: checkin.place_name,
          occurredAt: checkin.occurred_at,
          latitude: checkin.latitude,
          longitude: checkin.longitude,
        }))}
      />

      <MediaSelectionProvider slug={trip.slug}>
        <section
          className={`timeline page-shell real-timeline${timelineDays.length === 0 ? " is-empty" : ""}`}
        >
          {timelineDays.length === 0 ? (
            <div className="timeline-empty">
              <span>
                <MapPin size={20} />
              </span>
              <h2>No moments yet</h2>
              <p>
                Photos, videos, check-ins, and daily summaries will appear here in
                chronological order.
              </p>
            </div>
          ) : (
            timelineDays.map((day) => {
              const dayKey = timelineDateKey(day.date);
              const daySummaries = summariesByDate.get(dayKey) ?? [];
              const summaryAuthor = daySummaries[0]?.profiles?.[0];
              const summaryAuthorId = daySummaries[0]?.author_id;
              const summaryCanContribute = canContribute;

              return (
                <section key={dayKey} className="timeline-day">
                  <header className="day-heading">
                    <div className="date-tile">
                      <strong>
                        {new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(
                          day.date
                        )}
                      </strong>
                      <span>
                        {new Intl.DateTimeFormat("en-US", { month: "short" }).format(
                          day.date
                        )}
                      </span>
                    </div>

                    <div className="day-heading-copy">
                      <h2>
                        {new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
                          day.date
                        )}
                      </h2>

                      {day.checkins.length || day.media.length ? (
                        <p>{day.checkins.length + day.media.length} updates</p>
                      ) : null}
                    </div>
                  </header>

                  <div
                    className={`day-story-card day-post-card${day.checkins.length ? " has-checkins" : ""}${day.media.length ? " has-media" : ""}${!day.checkins.length && !daySummaries.length ? " is-empty" : ""}`}
                  >
                    <div className="day-post-copy">
                      {!day.checkins.length && summaryAuthor ? (
                        <div className="summary-post-author">
                          <span
                            className="post-avatar"
                            style={{
                              backgroundColor:
                                summaryAuthorId
                                  ? avatarColorById.get(summaryAuthorId) ?? "#dce8ff"
                                  : "#dce8ff",
                            }}
                          >
                            {initials(summaryAuthor.display_name)}
                          </span>

                          <div>
                            <strong>{summaryAuthor.display_name}</strong>
                            <span>Daily summary</span>
                          </div>
                        </div>
                      ) : null}

                      {day.checkins.map((checkin) => {
                        const author = travelerById.get(checkin.author_id);

                        return (
                          <CheckinCard
                            key={checkin.id}
                            checkin={{
                              id: checkin.id,
                              placeId: checkin.place_id,
                              placeName: checkin.place_name,
                              address: checkin.formatted_address,
                              note: checkin.note,
                              occurredAt: checkin.occurred_at,
                              latitude: checkin.latitude,
                              longitude: checkin.longitude,
                            }}
                            canManage={canContribute && userId === checkin.author_id}
                            slug={trip.slug}
                            postStyle
                            authorId={checkin.author_id}
                            authorName={author?.display_name ?? "Traveler"}
                            authorColor={
                              avatarColorById.get(checkin.author_id) ?? "#dce8ff"
                            }
                            travelers={travelers}
                            attendeeIds={attendeesByCheckin.get(checkin.id) ?? []}
                          />
                        );
                      })}

                      {daySummaries.length > 0 ? (
                        <DaySummary
                          tripId={trip.id}
                          slug={trip.slug}
                          date={dayKey}
                          summaries={daySummaries.map((summary) => ({
                            id: summary.id,
                            authorId: summary.author_id,
                            authorName: summary.profiles[0]?.display_name ?? "Traveler",
                            body: summary.body,
                          }))}
                          canContribute={summaryCanContribute}
                          userId={userId}
                          userName={
                            travelers.find((traveler) => traveler.id === userId)
                              ?.display_name ?? null
                          }
                        />
                      ) : null}
                    </div>

                    {day.media.length > 0 ? (
                      <MediaGallery
                        slug={trip.slug}
                        userId={userId}
                        returnTo={`/trip/${trip.slug}`}
                        items={day.media
                          .filter(
                            (item): item is typeof item & { url: string } =>
                              Boolean(item.url)
                          )
                          .map((item) => ({
                            id: item.id,
                            storagePath: item.storage_path,
                            thumbnailStoragePath: item.thumbnail_storage_path,
                            url: item.url,
                            thumbnailUrl: item.thumbnailUrl ?? item.url,
                            caption: item.caption,
                            kind: item.kind,
                            capturedAt: item.captured_at,
                            placeName: item.place_name,
                            latitude: item.latitude,
                            longitude: item.longitude,
                            uploaderId: item.uploader_id,
                            canManage: Boolean(userId && userId === item.uploader_id),
                            reactions: reactionsByMedia.get(item.id) ?? [],
                          }))
                          .sort(
                            (a, b) =>
                              mediaDateValue({
                                captured_at: a.capturedAt,
                                created_at: null,
                              }).getTime() -
                              mediaDateValue({
                                captured_at: b.capturedAt,
                                created_at: null,
                              }).getTime()
                          )}
                      />
                    ) : null}
                  </div>
                </section>
              );
            })
          )}
        </section>
      </MediaSelectionProvider>

      {canContribute ? (
        <AddMoment
          tripId={trip.id}
          slug={trip.slug}
          currentUserId={userId!}
          travelers={travelers}
        />
      ) : userId ? null : (
        <Link
          className="floating-add"
          href={`/login?returnTo=${encodeURIComponent(`/trip/${trip.slug}`)}`}
        >
          + Add Moment
        </Link>
      )}

      {storyMoments.length > 0 ? (
        <TripStory title={trip.name} moments={storyMoments} />
      ) : null}
    </main>
  );
}