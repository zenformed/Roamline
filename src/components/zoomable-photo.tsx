"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

type Point = { x: number; y: number };
type View = { scale: number; x: number; y: number };
type SingleGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  originX: number;
  originY: number;
  mode: "pan" | "swipe";
  horizontal: boolean;
  cancelled: boolean;
};
type PinchGesture = {
  startDistance: number;
  startScale: number;
  contentX: number;
  contentY: number;
};

type ZoomablePhotoProps = {
  src: string;
  alt: string;
  priority?: boolean;
  onSwipe?: (direction: -1 | 1) => void | Promise<void>;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const INITIAL_VIEW: View = { scale: MIN_SCALE, x: 0, y: 0 };

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function midpoint(first: Point, second: Point): Point {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function ZoomablePhoto({ src, alt, priority = false, onSwipe }: ZoomablePhotoProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const imageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const singleGestureRef = useRef<SingleGesture | null>(null);
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const pinchedRef = useRef(false);
  const viewRef = useRef<View>(INITIAL_VIEW);
  const swipeOffsetRef = useRef(0);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [interacting, setInteracting] = useState(false);

  const commitView = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const clampView = useCallback((next: View): View => {
    const surface = surfaceRef.current;
    const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next.scale));
    if (!surface || scale <= MIN_SCALE) return INITIAL_VIEW;
    const intrinsic = imageSizeRef.current;
    const fit = intrinsic
      ? Math.min(surface.clientWidth / intrinsic.width, surface.clientHeight / intrinsic.height)
      : 1;
    const renderedWidth = intrinsic ? intrinsic.width * fit : surface.clientWidth;
    const renderedHeight = intrinsic ? intrinsic.height * fit : surface.clientHeight;
    const maxX = Math.max(0, (renderedWidth * scale - surface.clientWidth) / 2);
    const maxY = Math.max(0, (renderedHeight * scale - surface.clientHeight) / 2);
    return {
      scale,
      x: Math.max(-maxX, Math.min(maxX, next.x)),
      y: Math.max(-maxY, Math.min(maxY, next.y)),
    };
  }, []);

  const commitSwipe = useCallback((offset: number) => {
    swipeOffsetRef.current = offset;
    setSwipeOffset(offset);
  }, []);

  const resetGesture = useCallback((resetView = false) => {
    pointersRef.current.clear();
    singleGestureRef.current = null;
    pinchGestureRef.current = null;
    pinchedRef.current = false;
    commitSwipe(0);
    setInteracting(false);
    if (resetView) commitView(INITIAL_VIEW);
  }, [commitSwipe, commitView]);

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => commitView(clampView(viewRef.current)));
    observer.observe(surface);
    return () => observer.disconnect();
  }, [clampView, commitView]);

  const beginPinch = useCallback(() => {
    const surface = surfaceRef.current;
    const points = [...pointersRef.current.values()];
    if (!surface || points.length < 2) return;
    const center = midpoint(points[0], points[1]);
    const bounds = surface.getBoundingClientRect();
    const current = viewRef.current;
    const localX = center.x - bounds.left - bounds.width / 2;
    const localY = center.y - bounds.top - bounds.height / 2;
    pinchGestureRef.current = {
      startDistance: Math.max(distance(points[0], points[1]), 1),
      startScale: current.scale,
      contentX: (localX - current.x - swipeOffsetRef.current) / current.scale,
      contentY: (localY - current.y) / current.scale,
    };
    singleGestureRef.current = null;
    pinchedRef.current = true;
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setInteracting(true);
    if (pointersRef.current.size >= 2) {
      event.preventDefault();
      beginPinch();
      return;
    }
    const current = viewRef.current;
    singleGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      originX: current.x,
      originY: current.y,
      mode: current.scale > MIN_SCALE ? "pan" : "swipe",
      horizontal: false,
      cancelled: false,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length >= 2) {
      event.preventDefault();
      const surface = surfaceRef.current;
      if (!surface) return;
      if (!pinchGestureRef.current) beginPinch();
      const pinch = pinchGestureRef.current;
      if (!pinch) return;
      const center = midpoint(points[0], points[1]);
      const bounds = surface.getBoundingClientRect();
      const scale = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, pinch.startScale * distance(points[0], points[1]) / pinch.startDistance)
      );
      const localX = center.x - bounds.left - bounds.width / 2;
      const localY = center.y - bounds.top - bounds.height / 2;
      commitSwipe(0);
      commitView(clampView({
        scale,
        x: localX - pinch.contentX * scale,
        y: localY - pinch.contentY * scale,
      }));
      return;
    }

    const gesture = singleGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || pinchedRef.current) return;
    if (gesture.cancelled) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    if (gesture.mode === "pan") {
      event.preventDefault();
      commitView(clampView({
        ...viewRef.current,
        x: gesture.originX + deltaX,
        y: gesture.originY + deltaY,
      }));
      return;
    }

    if (!gesture.horizontal) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) {
        gesture.cancelled = true;
        return;
      }
      gesture.horizontal = true;
    }
    if (!gesture.horizontal) return;
    event.preventDefault();
    const width = event.currentTarget.clientWidth || window.innerWidth;
    commitSwipe(Math.max(-width * 0.38, Math.min(width * 0.38, deltaX)));
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = singleGestureRef.current;
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    if (pointersRef.current.size === 1) {
      pinchGestureRef.current = null;
      pinchedRef.current = false;
      const [remaining] = [...pointersRef.current.entries()];
      if (viewRef.current.scale > MIN_SCALE) {
        singleGestureRef.current = {
          pointerId: remaining[0],
          startX: remaining[1].x,
          startY: remaining[1].y,
          startedAt: performance.now(),
          originX: viewRef.current.x,
          originY: viewRef.current.y,
          mode: "pan",
          horizontal: false,
          cancelled: false,
        };
      }
      return;
    }

    setInteracting(false);
    pinchGestureRef.current = null;
    singleGestureRef.current = null;
    if (pinchedRef.current || gesture?.mode === "pan") {
      pinchedRef.current = false;
      commitSwipe(0);
      if (viewRef.current.scale < 1.04) commitView(INITIAL_VIEW);
      return;
    }

    const deltaX = event.clientX - (gesture?.startX ?? event.clientX);
    const elapsed = Math.max(performance.now() - (gesture?.startedAt ?? performance.now()), 1);
    const threshold = Math.min(72, event.currentTarget.clientWidth * 0.16);
    const shouldSwipe = Boolean(
      gesture?.horizontal
      && onSwipe
      && (Math.abs(deltaX) >= threshold || Math.abs(deltaX) / elapsed >= 0.45)
    );
    commitSwipe(0);
    if (shouldSwipe) void onSwipe!(deltaX < 0 ? 1 : -1);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    resetGesture(false);
  }

  function changeScale(nextScale: number) {
    const current = viewRef.current;
    commitView(clampView({ ...current, scale: nextScale }));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault(); event.stopPropagation(); changeScale(viewRef.current.scale + .5);
    } else if (event.key === "-") {
      event.preventDefault(); event.stopPropagation(); changeScale(viewRef.current.scale - .5);
    } else if (event.key === "0" || event.key === "Escape" && viewRef.current.scale > MIN_SCALE) {
      event.preventDefault(); event.stopPropagation(); commitView(INITIAL_VIEW);
    }
  }

  return <div
    ref={surfaceRef}
    className={`zoomable-photo${view.scale > MIN_SCALE ? " is-zoomed" : ""}${interacting ? " is-interacting" : ""}`}
    role="img"
    aria-label={`${alt}. Pinch with two fingers to zoom; drag to pan while zoomed.`}
    tabIndex={0}
    onKeyDown={handleKeyDown}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerEnd}
    onPointerCancel={handlePointerCancel}
    onLostPointerCapture={handlePointerCancel}
  >
    <div
      className="zoomable-photo-swipe"
      style={{
        opacity: Math.max(.58, 1 - Math.abs(swipeOffset) / 700),
        transform: `translate3d(${swipeOffset}px, 0, 0)`,
      }}
    >
      <div
        className="zoomable-photo-transform"
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }}
      >
        <Image
          src={src}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          priority={priority}
          unoptimized
          draggable={false}
          onLoad={(event) => {
            imageSizeRef.current = {
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            };
            commitView(clampView(viewRef.current));
          }}
        />
      </div>
    </div>
  </div>;
}
