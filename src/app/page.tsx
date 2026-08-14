import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, MapPin, Plus, Sparkles } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { TripLibrary } from "@/components/trip-library";
import { createClient } from "@/lib/supabase/server";

type TripSummary = { id: string; owner_id: string; slug: string; name: string; description: string | null; start_date: string | null; end_date: string | null; visibility: "public" | "unlisted" | "private"; status: "draft" | "published" | "archived"; published_at: string | null };
type TripPhoto = { trip_id: string; storage_path: string; caption: string | null; captured_at: string | null; created_at: string };

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

export default async function Home({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const scope = (await searchParams).scope === "mine" ? "mine" : "all";
  const supabase = await createClient();
  const [{ data: claimsData }, { data, error }] = await Promise.all([supabase.auth.getClaims(), supabase.from("trips").select("id,owner_id,slug,name,description,start_date,end_date,visibility,status,published_at").order("start_date", { ascending: false, nullsFirst: false })]);
  let trips = (data ?? []) as TripSummary[];
  const signedIn = Boolean(claimsData?.claims);
  if (scope === "all") {
    trips = trips.filter((trip) => trip.visibility === "public");
  } else if (claimsData?.claims?.sub) {
    const { data: memberships } = await supabase.from("trip_members").select("trip_id").eq("user_id", claimsData.claims.sub);
    const memberIds = new Set((memberships ?? []).map((membership) => membership.trip_id));
    trips = trips.filter((trip) => trip.owner_id === claimsData.claims.sub || memberIds.has(trip.id));
  }
  const { data: photoData } = trips.length ? await supabase.from("media").select("trip_id,storage_path,caption,captured_at,created_at").in("trip_id", trips.map((trip) => trip.id)).eq("kind", "photo").order("captured_at", { ascending: false, nullsFirst: false }) : { data: [] };
  const photos = (photoData ?? []) as TripPhoto[];
  const selectedPhotos = photos.reduce<Map<string, TripPhoto[]>>((map, photo) => { const current = map.get(photo.trip_id) ?? []; if (current.length < 5) { current.push(photo); map.set(photo.trip_id, current); } return map; }, new Map());
  const paths = [...selectedPhotos.values()].flat().map((photo) => photo.storage_path);
  const signedPhotos = paths.length ? await supabase.storage.from("trip-media").createSignedUrls(paths, 3600) : { data: [] };
  const urlByPath = new Map(paths.map((path, index) => [path, signedPhotos.data?.[index]?.signedUrl ?? null]));

  return <main>
    <SiteHeader searchable />
    <section className="hero page-shell"><div className="eyebrow"><Sparkles size={13} /> Trips, shared simply</div><h1><span>Every journey has a story.</span><span>Keep yours together.</span></h1><p>A quiet place for family and friends to follow the route, see the moments, and travel along from anywhere.</p></section>
    <section className="page-shell" aria-labelledby="trip-library-heading">
      <div className="section-heading"><h2 id="trip-library-heading">{scope === "mine" ? "Your trips" : "All journeys"}</h2></div>
      {error ? <div className="library-state"><h3>Trips couldn’t be loaded</h3><p>Refresh the page to try again.</p></div> : trips.length === 0 ? <div className="library-state"><span className="state-mark"><MapPin size={22} /></span><h3>{scope === "mine" ? "Your travel shelf is ready" : "No public trips yet"}</h3><p>{scope === "mine" ? "Create a journey or accept an invitation to see it here." : "Check back when a new journey begins."}</p>{signedIn ? <Link className="primary-button" href="/trips/new"><Plus size={16} /> Create your first trip</Link> : <Link className="primary-button" href="/login?mode=signup">Create an account <ArrowUpRight size={16} /></Link>}</div> : <TripLibrary>{trips.map((trip, tripIndex) => {
        const tripPhotos = (selectedPhotos.get(trip.id) ?? []).map((photo) => ({ photo, url: urlByPath.get(photo.storage_path) })).filter((item): item is { photo: TripPhoto; url: string } => Boolean(item.url));
        const phase = tripPhase(trip);
        return <article className="journey-showcase" data-trip-name={trip.name} key={trip.id}><div className="showcase-heading"><div><span className="section-kicker">{phase.label}</span><h3>{trip.name}</h3></div><Link href={`/trip/${trip.slug}`} className="quiet-link">Open journey <ArrowUpRight size={15} /></Link></div><Link className="featured-trip" href={`/trip/${trip.slug}`}>
          {tripPhotos.length ? <div className={`featured-collage photo-count-${tripPhotos.length}`}>{tripPhotos.map(({ photo, url }, photoIndex) => <div className={`featured-photo featured-photo-${photoIndex + 1}`} key={photo.storage_path}><Image src={url} alt={photo.caption || `${trip.name} trip photo`} fill priority={tripIndex === 0 && photoIndex === 0} sizes="(max-width: 768px) 100vw, 70vw" /></div>)}</div> : <div className="featured-fallback cover-contour" />}
          <div className="featured-shade" /><div className={`live-pill${phase.live ? " is-live" : ""}`}><span /> {phase.label}</div><div className="featured-content"><div><p className="featured-date">{formatDateRange(trip.start_date, trip.end_date).toUpperCase()}</p><h3>{trip.name}</h3><p className="featured-route"><MapPin size={16} /> {trip.description || "The next journey is taking shape."}</p></div><div className="featured-meta"><span>{photos.filter((photo) => photo.trip_id === trip.id).length} moments</span><span className="circle-arrow"><ChevronRight size={20} /></span></div></div>
        </Link></article>;
      })}</TripLibrary>}
    </section>
    {trips.length > 0 && signedIn ? <section className="page-shell start-card"><div className="start-icon"><Plus size={20} /></div><div><h2>Where are you headed next?</h2><p>Create another journey and invite your people.</p></div><Link className="primary-button" href="/trips/new">Start a new trip <ArrowUpRight size={16} /></Link></section> : null}
    <Link className="floating-add" href={signedIn ? "/trips/new" : "/login?mode=signup&returnTo=/trips/new"}><Plus size={17} /> New trip</Link>
    <footer className="page-shell footer"><span className="brand small">Roamline</span><p>Made for the people you want along for the ride.</p><span>© 2026</span></footer>
  </main>;
}
