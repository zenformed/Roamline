"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ZoomablePhoto } from "@/components/zoomable-photo";

type DayMediaItem = { id: string; url: string; thumbnailUrl: string; caption: string | null; kind: "photo" | "video" };

export function DayMediaGallery({ slug, day, title }: { slug: string; day: string; title: string }) {
  const [items, setItems] = useState<DayMediaItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDialogElement>(null);
  const knownItemIds = useRef(new Set<string>());
  const requestInFlight = useRef<Promise<string | null> | null>(null);
  const navigationIntent = useRef(0);
  const viewerSession = useRef(0);
  const hasMore = totalCount === null || nextOffset < totalCount;
  const dayRange = useMemo(() => {
    const [year, month, date] = day.split("-").map(Number);
    return {
      start: new Date(year, month - 1, date).toISOString(),
      end: new Date(year, month - 1, date + 1).toISOString(),
    };
  }, [day]);

  const loadMore = useCallback(async () => {
    if (requestInFlight.current) return await requestInFlight.current;
    if (totalCount !== null && nextOffset >= totalCount) return null;
    setLoading(true); setError("");
    const request = (async () => {
      try {
        const query = new URLSearchParams({
          start: dayRange.start,
          end: dayRange.end,
          offset: String(nextOffset),
        });
        const response = await fetch(`/api/trips/${encodeURIComponent(slug)}/media?${query}`);
        if (!response.ok) throw new Error();
        const payload = (await response.json()) as { items: DayMediaItem[]; totalCount: number; nextOffset: number };
        setTotalCount(payload.totalCount);
        setNextOffset(payload.nextOffset);
        const additions = payload.items.filter((item) => !knownItemIds.current.has(item.id));
        for (const item of additions) knownItemIds.current.add(item.id);
        if (additions.length) setItems((current) => [...current, ...additions]);
        return additions[0]?.id ?? null;
      } catch {
        setError("More photos could not be loaded. Try again.");
        return null;
      } finally {
        setLoading(false);
      }
    })();
    requestInFlight.current = request;
    try {
      return await request;
    } finally {
      if (requestInFlight.current === request) requestInFlight.current = null;
    }
  }, [dayRange.end, dayRange.start, nextOffset, slug, totalCount]);

  useEffect(() => {
    if (totalCount !== null || nextOffset > 0) return;
    const timer = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMore, nextOffset, totalCount]);

  useEffect(() => {
    const target = loaderRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "500px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  function open(index: number) { viewerSession.current += 1; setActiveIndex(index); viewerRef.current?.showModal(); }
  const active = activeIndex === null ? null : items[activeIndex];

  const move = useCallback(async (direction: -1 | 1) => {
    if (activeIndex === null) return;
    const intent = ++navigationIntent.current;
    const nextIndex = activeIndex + direction;
    if (nextIndex >= 0 && nextIndex < items.length) {
      setActiveIndex(nextIndex);
      return;
    }
    if (direction !== 1 || !hasMore) return;
    const boundaryIndex = activeIndex;
    const boundarySession = viewerSession.current;
    const nextItemId = await loadMore();
    if (nextItemId) {
      setActiveIndex((current) => current === boundaryIndex
        && viewerSession.current === boundarySession
        && navigationIntent.current === intent
        ? current + 1
        : current);
    }
  }, [activeIndex, hasMore, items.length, loadMore]);

  useEffect(() => {
    if (activeIndex === null) return;
    for (const item of [items[activeIndex - 1], items[activeIndex + 1]]) {
      if (!item || item.kind !== "photo") continue;
      const image = new window.Image();
      image.src = item.url;
    }
    if (!hasMore || activeIndex < items.length - 5) return;
    const timer = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(timer);
  }, [activeIndex, hasMore, items, loadMore]);

  return <>
    <main className="day-gallery-page">
      <header className="day-gallery-header">
        <Link href={`/trip/${slug}`}><ArrowLeft size={18} /> Back to journey</Link>
        <div><span>{title}</span><h1>{new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date(`${day}T12:00:00`))}</h1><p>{totalCount === null ? "Loading moments…" : `${totalCount} ${totalCount === 1 ? "moment" : "moments"}`}</p></div>
      </header>
      <section className="day-gallery-grid" aria-label={`Photos and videos from ${day}`}>
        {items.map((item, index) => <button type="button" key={item.id} onClick={() => open(index)} aria-label={`Open ${item.caption || `moment ${index + 1}`}`}>
          {item.kind === "photo" || item.thumbnailUrl ? <Image src={item.thumbnailUrl} alt={item.caption || "Trip photo"} fill sizes="(max-width: 700px) 50vw, 25vw" /> : <video src={item.url} muted preload="metadata" />}
        </button>)}
      </section>
      <div className="day-gallery-loader" ref={loaderRef} aria-live="polite">{loading ? <><LoaderCircle className="spin" size={18} /> Loading more…</> : error ? <button type="button" onClick={() => void loadMore()}>{error}</button> : hasMore ? "" : items.length ? "All moments loaded" : "No moments found"}</div>
    </main>
    <dialog className="day-gallery-viewer" ref={viewerRef} onClose={() => { viewerSession.current += 1; setActiveIndex(null); }} onKeyDown={(event) => { if ((event.target as HTMLElement).closest("video,input,textarea,select")) return; if (event.key === "ArrowLeft") { event.preventDefault(); void move(-1); } if (event.key === "ArrowRight") { event.preventDefault(); void move(1); } }}>
      {active ? <div className={`day-gallery-viewer-stage ${active.kind === "photo" ? "has-photo" : "has-video"}`}>
        <div className="day-gallery-viewer-media">
          {active.kind === "photo" ? <ZoomablePhoto key={active.id} src={active.url} alt={active.caption || "Trip photo"} priority onSwipe={(direction) => move(direction)} /> : <video key={active.id} src={active.url} controls autoPlay playsInline />}
        </div>
        <button className="day-gallery-viewer-close" type="button" aria-label="Close viewer" onClick={() => viewerRef.current?.close()}><X size={22} /></button>
        {items.length > 1 || hasMore ? <>
          <button className="day-gallery-viewer-nav previous" type="button" aria-label="Previous photo or video" disabled={activeIndex === 0} onClick={() => void move(-1)}><ChevronLeft size={25} /></button>
          <button className="day-gallery-viewer-nav next" type="button" aria-label="Next photo or video" disabled={activeIndex === items.length - 1 && !hasMore} onClick={() => void move(1)}>{loading && activeIndex === items.length - 1 ? <LoaderCircle className="spin" size={20} /> : <ChevronRight size={25} />}</button>
        </> : null}
        <span className="day-gallery-viewer-count" aria-live="polite">{activeIndex! + 1} of {totalCount ?? items.length}</span>
        {active.caption ? <p>{active.caption}</p> : null}
      </div> : null}
    </dialog>
  </>;
}
