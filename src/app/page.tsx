import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, MapPin, Plus, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { TripLibrary } from "@/components/trip-library";
import { createClient } from "@/lib/supabase/server";

type TripSummary = { id: string; owner_id: string; slug: string; name: string; description: string | null; start_date: string | null; end_date: string | null; visibility: "public" | "unlisted" | "private"; status: "draft" | "published" | "archived"; published_at: string | null };
type TripPhoto = { trip_id: string; storage_path: string; thumbnail_storage_path: string | null; caption: string | null; captured_at: string | null; created_at: string };
type HomeSearchParams = { scope?: string; q?: string; page?: string };

const TRIPS_PER_PAGE = 10;

function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return "Dates open";
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (start && end) return `${formatter.format(new Date(`${start}T12:00:00`))} – ${formatter.format(new Date(`${end}T12:00:00`))}`;
  return formatter.format(new Date(`${start ?? end}T12:00:00`));
}

function tripPhase(trip: TripSummary) {
  if (trip.status === "draft") return { label: "Draft", live: false };
  if (trip.status === "archived") return { label: "Archived", live: false };
  const today = new Date().toISOString().slice(0, 10);
  if (trip.start_date && today < trip.start_date) return { label: "Upcoming", live: false };
  if (trip.end_date && today > trip.end_date) return { label: "Past journey", live: false };
  if (trip.start_date && (!trip.end_date || today <= trip.end_date)) return { label: "Happening now", live: true };
  return { label: "Shared journey", live: false };
}

function parsePage(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

function searchPattern(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function libraryHref(scope: "all" | "mine", query: string, page: number) {
  const params = new URLSearchParams();
  if (scope === "mine") params.set("scope", "mine");
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/?${suffix}` : "/";
}

export default async function Home({ searchParams }: { searchParams: Promise<HomeSearchParams> }) {
  const params = await searchParams;
  const scope: "all" | "mine" = params.scope === "mine" ? "mine" : "all";
  const query = (params.q ?? "").trim().slice(0, 100);
  const page = parsePage(params.page);
  const from = (page - 1) * TRIPS_PER_PAGE;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  const signedIn = Boolean(userId);

  let memberTripIds: string[] = [];
  if (scope === "mine" && userId) {
    const [{ data: memberships }, { data: follows }] = await Promise.all([
      supabase.from("trip_members").select("trip_id").eq("user_id", userId),
      supabase.from("trip_follows").select("trip_id").eq("user_id", userId),
    ]);
    memberTripIds = [...new Set([...(memberships ?? []).map((membership) => membership.trip_id), ...(follows ?? []).map((follow) => follow.trip_id)])];
  }

  let tripQuery = supabase.from("trips").select("id,owner_id,slug,name,description,start_date,end_date,visibility,status,published_at", { count: "exact" });
  if (scope === "all") tripQuery = tripQuery.eq("visibility", "public");
  else if (!userId) tripQuery = tripQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  else if (memberTripIds.length) tripQuery = tripQuery.or(`owner_id.eq.${userId},id.in.(${memberTripIds.join(",")})`);
  else tripQuery = tripQuery.eq("owner_id", userId);
  if (query) tripQuery = tripQuery.ilike("name", searchPattern(query));

  const { data, error, count } = await tripQuery
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .range(from, from + TRIPS_PER_PAGE - 1);
  const trips = (data ?? []) as TripSummary[];
  const totalTrips = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTrips / TRIPS_PER_PAGE));
  if (!error && page > totalPages) redirect(libraryHref(scope, query, totalPages));

  const mediaResults = await Promise.all(trips.map(async (trip) => {
    const [photoPage, momentCount] = await Promise.all([
      supabase.from("media").select("trip_id,storage_path,thumbnail_storage_path,caption,captured_at,created_at").eq("trip_id", trip.id).eq("kind", "photo").order("captured_at", { ascending: false, nullsFirst: false }).order("id", { ascending: true }).limit(5),
      supabase.from("media").select("id", { count: "exact", head: true }).eq("trip_id", trip.id),
    ]);
    return { tripId: trip.id, photos: (photoPage.data ?? []) as TripPhoto[], count: momentCount.count ?? 0 };
  }));
  const selectedPhotos = new Map(mediaResults.map((result) => [result.tripId, result.photos]));
  const momentCountByTrip = new Map(mediaResults.map((result) => [result.tripId, result.count]));
  const paths = [...selectedPhotos.values()].flat().map((photo) => photo.thumbnail_storage_path ?? photo.storage_path);
  const signedPhotos = paths.length ? await supabase.storage.from("trip-media").createSignedUrls(paths, 3600) : { data: [] };
  const urlByPath = new Map(paths.map((path, index) => [path, signedPhotos.data?.[index]?.signedUrl ?? null]));

  return <main>
    <SiteHeader searchable searchQuery={query} />
    <section className="hero page-shell"><div className="eyebrow"><Sparkles size={13} /> Trips, shared simply</div><h1><span>Every journey has a story.</span><span>Keep yours together.</span></h1><p>A quiet place for family and friends to follow the route, see the moments, and travel along from anywhere.</p></section>
    <section className="page-shell" aria-labelledby="trip-library-heading">
      <div className="section-heading"><h2 id="trip-library-heading">{scope === "mine" ? "Your trips" : "All journeys"}</h2></div>
      {error ? <div className="library-state"><h3>Trips couldn’t be loaded</h3><p>Refresh the page to try again.</p></div> : trips.length === 0 ? <div className="library-state"><span className="state-mark"><MapPin size={22} /></span><h3>{query ? "No matching trips" : scope === "mine" ? "Your travel shelf is ready" : "No public trips yet"}</h3><p>{query ? "Try another trip name." : scope === "mine" ? "Create a journey or accept an invitation to see it here." : "Check back when a new journey begins."}</p>{!query && (signedIn ? <Link className="primary-button" href="/trips/new"><Plus size={16} /> Create your first trip</Link> : <Link className="primary-button" href="/login?mode=signup">Create an account <ArrowUpRight size={16} /></Link>)}</div> : <>
        <TripLibrary>{trips.map((trip, tripIndex) => {
          const tripPhotos = (selectedPhotos.get(trip.id) ?? []).map((photo) => ({ photo, url: urlByPath.get(photo.thumbnail_storage_path ?? photo.storage_path) })).filter((item): item is { photo: TripPhoto; url: string } => Boolean(item.url));
          const phase = tripPhase(trip);
          return <article className="journey-showcase" data-trip-name={trip.name} key={trip.id}><div className="showcase-heading"><div><span className="section-kicker">{phase.label}</span><h3>{trip.name}</h3></div><Link href={`/trip/${trip.slug}`} className="quiet-link">Open journey <ArrowUpRight size={15} /></Link></div><Link className="featured-trip" href={`/trip/${trip.slug}`}>
            {tripPhotos.length ? <div className={`featured-collage photo-count-${tripPhotos.length}`}>{tripPhotos.map(({ photo, url }, photoIndex) => <div className={`featured-photo featured-photo-${photoIndex + 1}`} key={photo.storage_path}><Image src={url} alt={photo.caption || `${trip.name} trip photo`} fill priority={tripIndex === 0 && photoIndex === 0} sizes="(max-width: 768px) 100vw, 70vw" /></div>)}</div> : <div className="featured-fallback cover-contour" />}
            <div className="featured-shade" /><div className={`live-pill${phase.live ? " is-live" : ""}`}><span /> {phase.label}</div><div className="featured-content"><div><p className="featured-date">{formatDateRange(trip.start_date, trip.end_date).toUpperCase()}</p><h3>{trip.name}</h3><p className="featured-route"><MapPin size={16} /> {trip.description || "The next journey is taking shape."}</p></div><div className="featured-meta"><span>{momentCountByTrip.get(trip.id) ?? 0} moments</span><span className="circle-arrow"><ChevronRight size={20} /></span></div></div>
          </Link></article>;
        })}</TripLibrary>
        <nav className="trip-pagination" aria-label="Trip pages" data-preview-single-page={totalPages === 1 ? "true" : undefined}>{page > 1 ? <Link href={libraryHref(scope, query, page - 1)} rel="prev" aria-label="Previous trip page"><ChevronLeft size={17} /><span>Previous</span></Link> : <span className="page-arrow is-disabled" aria-hidden="true"><ChevronLeft size={17} /><span>Previous</span></span>}<p><strong>Page {page} of {totalPages}</strong><span>{from + 1}–{from + trips.length} of {totalTrips} trips</span></p>{page < totalPages ? <Link href={libraryHref(scope, query, page + 1)} rel="next" aria-label="Next trip page"><span>Next</span><ChevronRight size={17} /></Link> : <span className="page-arrow is-disabled" aria-hidden="true"><span>Next</span><ChevronRight size={17} /></span>}</nav>
      </>}
    </section>
    {trips.length > 0 && signedIn ? <section className="page-shell start-card"><div><h2>Where are you headed next?</h2><p>Create another journey and invite your people.</p></div><Link className="primary-button" href="/trips/new">Start a new trip <ArrowUpRight size={16} /></Link></section> : null}
    <Link className="floating-add" href={signedIn ? "/trips/new" : "/login?mode=signup&returnTo=/trips/new"}><Plus size={17} /> New trip</Link>
    <footer className="page-shell footer"><span className="brand small">Roamline</span><span>© 2026</span></footer>
  </main>;
}
