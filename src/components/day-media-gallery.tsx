"use client";

import { ArrowLeft, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type DayMediaItem = { id: string; url: string; thumbnailUrl: string; caption: string | null; kind: "photo" | "video" };

export function DayMediaGallery({ slug, day, title, totalCount }: { slug: string; day: string; title: string; totalCount: number }) {
  const [items, setItems] = useState<DayMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDialogElement>(null);
  const requestInFlight = useRef(false);
  const hasMore = items.length < totalCount;

  const loadMore = useCallback(async () => {
    if (requestInFlight.current || items.length >= totalCount) return;
    requestInFlight.current = true;
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/media?day=${encodeURIComponent(day)}&offset=${items.length}`);
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { items: DayMediaItem[] };
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...payload.items.filter((item) => !known.has(item.id))];
      });
    } catch {
      setError("More photos could not be loaded. Try again.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [day, items.length, slug, totalCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMore]);

  useEffect(() => {
    const target = loaderRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "500px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  function open(index: number) { setActiveIndex(index); viewerRef.current?.showModal(); }
  const active = activeIndex === null ? null : items[activeIndex];

  return <>
    <main className="day-gallery-page">
      <header className="day-gallery-header">
        <Link href={`/trip/${slug}`}><ArrowLeft size={18} /> Back to journey</Link>
        <div><span>{title}</span><h1>{new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date(`${day}T12:00:00`))}</h1><p>{totalCount} {totalCount === 1 ? "moment" : "moments"}</p></div>
      </header>
      <section className="day-gallery-grid" aria-label={`Photos and videos from ${day}`}>
        {items.map((item, index) => <button type="button" key={item.id} onClick={() => open(index)} aria-label={`Open ${item.caption || `moment ${index + 1}`}`}>
          {item.kind === "photo" || item.thumbnailUrl ? <Image src={item.thumbnailUrl} alt={item.caption || "Trip photo"} fill sizes="(max-width: 700px) 50vw, 25vw" /> : <video src={item.url} muted preload="metadata" />}
        </button>)}
      </section>
      <div className="day-gallery-loader" ref={loaderRef} aria-live="polite">{loading ? <><LoaderCircle className="spin" size={18} /> Loading more…</> : error ? <button type="button" onClick={() => void loadMore()}>{error}</button> : hasMore ? "" : items.length ? "All moments loaded" : "No moments found"}</div>
    </main>
    <dialog className="day-gallery-viewer" ref={viewerRef} onClose={() => setActiveIndex(null)}>
      {active ? <div>{active.kind === "photo" ? <Image src={active.thumbnailUrl} alt={active.caption || "Trip photo"} fill sizes="100vw" priority /> : <video src={active.url} controls autoPlay playsInline />}<button type="button" aria-label="Close viewer" onClick={() => viewerRef.current?.close()}><X size={22} /></button>{active.caption ? <p>{active.caption}</p> : null}</div> : null}
    </dialog>
  </>;
}
