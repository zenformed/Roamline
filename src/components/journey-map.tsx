"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { loadMaps, loadMarker } from "@/lib/google-maps";

export type JourneyPoint = { id: string; name: string; occurredAt: string; latitude: number; longitude: number };

export function JourneyMap({ points }: { points: JourneyPoint[] }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    const listeners: google.maps.MapsEventListener[] = [];
    let focusHandler: ((event: Event) => void) | null = null;

    void Promise.all([loadMaps(), loadMarker()]).then(([{ Map: GoogleMap, Polyline }, { Marker }]) => {
      if (disposed || !elementRef.current) return;
      const route = [...points].reverse();
      const map = new GoogleMap(elementRef.current, {
        center: route[0] ? { lat: route[0].latitude, lng: route[0].longitude } : { lat: 20, lng: 0 },
        zoom: route.length ? 6 : 2,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: "cooperative",
      });
      const bounds = new google.maps.LatLngBounds();
      const markers = new globalThis.Map<string, google.maps.Marker>();
      route.forEach((point, index) => {
        const position = { lat: point.latitude, lng: point.longitude };
        bounds.extend(position);
        const marker = new Marker({ map, position, title: point.name, label: { text: String(index + 1), color: "white", fontWeight: "600" } });
        markers.set(point.id, marker);
        listeners.push(marker.addListener("click", () => document.getElementById(`checkin-${point.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })));
      });
      if (route.length > 1) {
        new Polyline({ map, path: route.map((point) => ({ lat: point.latitude, lng: point.longitude })), strokeColor: "#e04b35", strokeOpacity: .9, strokeWeight: 4, geodesic: true });
        map.fitBounds(bounds, 52);
      } else if (route.length === 1) map.setZoom(13);
      focusHandler = (event) => {
        const id = (event as CustomEvent<string>).detail;
        const marker = markers.get(id);
        const position = marker?.getPosition();
        if (position) {
          elementRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          map.panTo(position);
          map.setZoom(Math.max(map.getZoom() ?? 13, 13));
        }
      };
      window.addEventListener("roamline:focus-map", focusHandler);
    }).catch(() => setError("The map could not load. Check the Google Maps key and website restrictions."));

    return () => { disposed = true; listeners.forEach((listener) => listener.remove()); if (focusHandler) window.removeEventListener("roamline:focus-map", focusHandler); };
  }, [points]);

  return <section className="map-wrap page-shell google-map-wrap" aria-label="Journey map">
    <div className="google-map" ref={elementRef} />
    {!points.length ? <div className="map-empty-copy map-empty-overlay"><span><MapPin size={19} /></span><h2>The route starts here</h2><p>Check-ins will draw the journey across the map.</p></div> : null}
    {error ? <div className="map-error" role="alert">{error}</div> : null}
  </section>;
}
