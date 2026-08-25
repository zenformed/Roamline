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

type Trip = { id: string; owner_id: string; name: string; slug: string; description: string | null; start_date: string | null; end_date: string | null; status: string; visibility: string };
type Checkin = { id: string; author_id: string; place_id: string | null; place_name: string; formatted_address: string | null; note: string | null; occurred_at: string; latitude: number; longitude: number };
type Media = { id: string; uploader_id: string; storage_path: string; thumbnail_storage_path: string | null; caption: string | null; kind: "photo" | "video"; captured_at: string | null; created_at: string; place_name: string | null; latitude: number | null; longitude: number | null };
type Reaction = { media_id: string; emoji: string };
type Traveler = { id: string; display_name: string };
type Invitation = { id: string; token: string; expires_at: string };
type DaySummaryRecord = { id: string; summary_date: string; author_id: string; body: string; created_at: string; profiles: { display_name: string }[] };
type CheckinAttendee = { checkin_id: string; user_id: string };

const AVATAR_COLORS = ["#dce8ff", "#ffe0da", "#dff1e5", "#eee1ff", "#fff0c7", "#d9eef2", "#f3ddea", "#e7e5d5"];
function initials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); return `${parts[0]?.[0] ?? "T"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase(); }
function travelerColors(travelers: Traveler[]) {
  const used = new Set<number>();
  return travelers.map((traveler) => { let color = [...traveler.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_COLORS.length; while (used.has(color) && used.size < AVATAR_COLORS.length) color = (color + 1) % AVATAR_COLORS.length; used.add(color); return AVATAR_COLORS[color]; });
}

function tripDates(start: string | null, end: string | null) {
  if (!start && !end) return "Dates open";
  const formatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" });
  if (start && end) return `${formatter.format(new Date(`${start}T12:00:00`))} – ${formatter.format(new Date(`${end}T12:00:00`))}`;
  return formatter.format(new Date(`${start ?? end}T12:00:00`));
}

function timelineDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export async function generateMetadata({ params }: PageProps<"/trip/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("trips").select("name,description").eq("slug", slug).maybeSingle();
  return { title: data ? `${data.name} — Roamline` : "Trip not found — Roamline", description: data?.description ?? "Follow the journey on Roamline." };
}

export default async function TripPage({ params }: PageProps<"/trip/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tripData } = await supabase.from("trips").select("id,owner_id,name,slug,description,start_date,end_date,status,visibility").eq("slug", slug).maybeSingle();
  if (!tripData) notFound();
  const trip = tripData as Trip;
  const [{ data: checkinData }, { data: mediaData }, { data: memberData }, { data: userData }, { data: reactionData }, { data: summaryData }] = await Promise.all([
    supabase.from("checkins").select("id,author_id,place_id,place_name,formatted_address,note,occurred_at,latitude,longitude").eq("trip_id", trip.id).order("occurred_at", { ascending: false }),
    supabase.from("media").select("id,uploader_id,storage_path,thumbnail_storage_path,caption,kind,captured_at,created_at,place_name,latitude,longitude").eq("trip_id", trip.id).order("captured_at", { ascending: false, nullsFirst: false }),
    supabase.from("trip_members").select("user_id").eq("trip_id", trip.id),
    supabase.auth.getUser(),
    supabase.from("reactions").select("media_id,emoji"),
    supabase.from("day_summaries").select("id,summary_date,author_id,body,created_at,profiles!day_summaries_author_id_fkey(display_name)").eq("trip_id", trip.id).order("created_at", { ascending: true }),
  ]);
  const checkins = (checkinData ?? []) as Checkin[];
  const { data: attendeeData } = checkins.length ? await supabase.from("checkin_attendees").select("checkin_id,user_id").in("checkin_id", checkins.map((checkin) => checkin.id)) : { data: [] };
  const media = (mediaData ?? []) as Media[];
  const mediaPaths = [...new Set(media.flatMap((item) => [item.storage_path, item.thumbnail_storage_path].filter((path): path is string => Boolean(path))))];
  const signedMedia = mediaPaths.length ? await supabase.storage.from("trip-media").createSignedUrls(mediaPaths, 3600) : { data: [] };
  const mediaUrlByPath = new Map(mediaPaths.map((path, index) => [path, signedMedia.data?.[index]?.signedUrl ?? null]));
  const mediaWithUrls = media.map((item) => ({ ...item, url: mediaUrlByPath.get(item.storage_path) ?? null, thumbnailUrl: mediaUrlByPath.get(item.thumbnail_storage_path ?? item.storage_path) ?? null }));
  const reactionsByMedia = new Map<string, string[]>();
  for (const reaction of (reactionData ?? []) as Reaction[]) reactionsByMedia.set(reaction.media_id, [...(reactionsByMedia.get(reaction.media_id) ?? []), reaction.emoji]);
  const travelerIds = [...new Set([trip.owner_id, ...(memberData ?? []).map((member) => member.user_id)])];
  const { data: travelerData } = await supabase.from("profiles").select("id,display_name").in("id", travelerIds);
  const travelers = (travelerData ?? []) as Traveler[];
  const avatarColors = travelerColors(travelers);
  const travelerById = new Map(travelers.map((traveler) => [traveler.id, traveler]));
  const avatarColorById = new Map(travelers.map((traveler, index) => [traveler.id, avatarColors[index]]));
  const attendeesByCheckin = new Map<string, string[]>();
  for (const attendee of (attendeeData ?? []) as CheckinAttendee[]) attendeesByCheckin.set(attendee.checkin_id, [...(attendeesByCheckin.get(attendee.checkin_id) ?? []), attendee.user_id]);
  const canContribute = Boolean(userData.user && (trip.owner_id === userData.user.id || memberData?.some((member) => member.user_id === userData.user.id)));
  const summariesByDate = new Map<string, DaySummaryRecord[]>();
  for (const summary of (summaryData ?? []) as DaySummaryRecord[]) summariesByDate.set(summary.summary_date, [...(summariesByDate.get(summary.summary_date) ?? []), summary]);
  const dayMap = new Map<string, { date: Date; checkins: Checkin[]; media: typeof mediaWithUrls }>();
  for (const checkin of checkins) {
    const date = new Date(checkin.occurred_at); const key = timelineDateKey(date);
    const day = dayMap.get(key) ?? { date, checkins: [], media: [] }; day.checkins.push(checkin); dayMap.set(key, day);
  }
  for (const item of mediaWithUrls) {
    const date = new Date(item.captured_at ?? item.created_at); const key = timelineDateKey(date);
    const day = dayMap.get(key) ?? { date, checkins: [], media: [] }; day.media.push(item); dayMap.set(key, day);
  }
  for (const [summaryDate] of summariesByDate) {
    if (!dayMap.has(summaryDate)) dayMap.set(summaryDate, { date: new Date(`${summaryDate}T12:00:00`), checkins: [], media: [] });
  }
  const timelineDays = [...dayMap.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
  const userId = userData.user?.id ?? null;
  const { data: followData } = userId && userId !== trip.owner_id ? await supabase.from("trip_follows").select("notifications_enabled").eq("trip_id", trip.id).eq("user_id", userId).maybeSingle() : { data: null };
  const { data: invitationData } = userId === trip.owner_id ? await supabase.from("trip_invitations").select("id,token,expires_at").eq("trip_id", trip.id).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }) : { data: [] };
  const collaborators = travelers.filter((traveler) => traveler.id !== trip.owner_id).map((traveler) => ({ id: traveler.id, displayName: traveler.display_name }));
  const invitations = ((invitationData ?? []) as Invitation[]).map((invitation) => ({ id: invitation.id, token: invitation.token, expiresAt: invitation.expires_at }));
  const storyMoments = mediaWithUrls.filter((item): item is typeof item & { url: string } => Boolean(item.url)).sort((a, b) => new Date(a.captured_at ?? a.created_at).getTime() - new Date(b.captured_at ?? b.created_at).getTime()).map((item) => ({ id: item.id, url: item.url, kind: item.kind, caption: item.caption, placeName: item.place_name, capturedAt: item.captured_at ?? item.created_at }));

  return <main className="journey-page">
    <header className="site-header journey-header"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>Roamline</Link><nav className="header-actions" aria-label="Primary navigation"><ThemeToggle /><HeaderNavigation signedIn={Boolean(userId)} displayName={travelers.find((traveler) => traveler.id === userId)?.display_name ?? userData.user?.email ?? null} shareTitle={`${trip.name} on Roamline`} shareTripId={trip.id} shareVisibility={trip.visibility} canEnableLinkSharing={userId === trip.owner_id} inviteTripId={userId === trip.owner_id ? trip.id : undefined} inviteUserId={userId === trip.owner_id ? userId : undefined} collaborators={collaborators} invitations={invitations} /></nav></header>
    <section className="journey-intro page-shell"><div><p className="journey-overline">{trip.status === "published" ? "SHARED JOURNEY" : trip.status.toUpperCase()}</p><div className="journey-title-row"><div className="journey-title-main"><h1>{trip.name}</h1>{userId === trip.owner_id ? <Link className="trip-title-edit" href={`/trip/${trip.slug}/edit`} aria-label="Edit trip settings" title="Edit trip"><Pencil size={13} /></Link> : null}<TripStory title={trip.name} moments={storyMoments} /></div></div><p className="journey-description">{trip.description || "A new journey is about to begin."}</p><p className="trip-date-line"><CalendarDays size={14} /> {tripDates(trip.start_date, trip.end_date)}</p></div><div className="journey-side">{userId !== trip.owner_id ? <FollowTrip tripId={trip.id} slug={trip.slug} signedIn={Boolean(userId)} initialFollowing={Boolean(followData)} initialNotifications={Boolean(followData?.notifications_enabled)} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} /> : null}<div className="journey-people"><div className="avatar-stack" aria-label={travelers.map((traveler) => traveler.display_name).join(", ")}>{travelers.map((traveler, index) => <span key={traveler.id} title={traveler.display_name} style={{ backgroundColor: avatarColors[index] }}>{initials(traveler.display_name)}</span>)}</div><p>{travelers.length === 1 ? "1 traveler" : `${travelers.length} travelers`}</p></div></div></section>
    <JourneyMap points={checkins.map((checkin) => ({ id: checkin.id, name: checkin.place_name, occurredAt: checkin.occurred_at, latitude: checkin.latitude, longitude: checkin.longitude }))} />
    <MediaSelectionProvider slug={trip.slug}><section className={`timeline page-shell real-timeline${timelineDays.length === 0 ? " is-empty" : ""}`}>
      {timelineDays.length === 0 ? <div className="timeline-empty"><span><MapPin size={20} /></span><h2>No moments yet</h2><p>Photos, videos, check-ins, and daily summaries will appear here in chronological order.</p></div> : <><div className="timeline-rail" aria-hidden="true"><span /></div>{timelineDays.map((day) => { const dayKey = timelineDateKey(day.date); const daySummaries = summariesByDate.get(dayKey) ?? []; const summaryAuthor = daySummaries[0] ? travelerById.get(daySummaries[0].author_id) : null; const summaryCanContribute = canContribute; return <section className="timeline-day" key={dayKey}>
        <header className="day-heading"><div className="date-tile"><strong>{new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(day.date)}</strong><span>{new Intl.DateTimeFormat("en-US", { month: "short" }).format(day.date).toUpperCase()}</span></div><div><span>{new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(day.date)}</span><h2>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(day.date)}</h2><p>{day.checkins.length + day.media.length} {day.checkins.length + day.media.length === 1 ? "moment" : "moments"}</p></div></header>
        <div className={`day-story-card day-post-card${day.checkins.length ? " has-checkins" : ""}${day.media.length ? " has-media" : ""}${!day.checkins.length && !daySummaries.length ? " media-only" : ""}`}>
          <div className="day-post-copy">
            {!day.checkins.length && summaryAuthor ? <div className="summary-post-author"><span className="post-avatar" style={{ backgroundColor: avatarColorById.get(summaryAuthor.id) }}>{initials(summaryAuthor.display_name)}</span><div><strong>{summaryAuthor.display_name}</strong><time>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(daySummaries[0].created_at))}</time></div></div> : null}
            {day.checkins.map((checkin) => { const author = travelerById.get(checkin.author_id); return <CheckinCard key={checkin.id} slug={trip.slug} postStyle authorId={checkin.author_id} authorName={author?.display_name ?? "Traveler"} authorColor={avatarColorById.get(checkin.author_id)} travelers={travelers} attendeeIds={attendeesByCheckin.get(checkin.id) ?? []} canManage={Boolean(userId && (userId === trip.owner_id || (canContribute && userId === checkin.author_id)))} checkin={{ id: checkin.id, placeId: checkin.place_id, placeName: checkin.place_name, address: checkin.formatted_address, note: checkin.note, occurredAt: checkin.occurred_at, latitude: checkin.latitude, longitude: checkin.longitude }} /> })}
            <DaySummary tripId={trip.id} slug={trip.slug} date={dayKey} canContribute={summaryCanContribute} userId={userId} userName={travelers.find((traveler) => traveler.id === userId)?.display_name ?? null} summaries={daySummaries.map((summary) => ({ id: summary.id, authorId: summary.author_id, authorName: summary.profiles[0]?.display_name ?? "Traveler", body: summary.body }))} />
          </div>
          {day.media.length > 0 ? <MediaGallery slug={trip.slug} userId={userId} returnTo={`/trip/${trip.slug}`} items={day.media.filter((item): item is typeof item & { url: string } => Boolean(item.url)).map((item) => ({ id: item.id, storagePath: item.storage_path, thumbnailStoragePath: item.thumbnail_storage_path, url: item.url, thumbnailUrl: item.thumbnailUrl ?? item.url, caption: item.caption, kind: item.kind, capturedAt: item.captured_at, placeName: item.place_name, latitude: item.latitude, longitude: item.longitude, reactions: reactionsByMedia.get(item.id) ?? [], canManage: Boolean(userId && (userId === trip.owner_id || (canContribute && userId === item.uploader_id))) }))} /> : null}
        </div>
      </section>})}</>}
    </section></MediaSelectionProvider>
    {canContribute ? <AddMoment tripId={trip.id} slug={trip.slug} currentUserId={userId!} travelers={travelers} /> : userId ? null : <Link className="floating-add" href={`/login?returnTo=${encodeURIComponent(`/trip/${trip.slug}`)}`}><Plus size={17} /> Sign in to add</Link>}
  </main>;
}
