"use client";

import { ImageIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { loadMaps, loadPlaces, loadMarker } from "@/lib/google-maps";

export function PlacePreviewDialog({ placeId, name, latitude, longitude, open, onClose }: { placeId: string | null; name: string; latitude: number; longitude: number; open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || !placeId) return;
    let active = true;
    void loadPlaces().then(async ({ Place }) => {
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ["photos"] });
      const photo = place.photos?.[0];
      if (active) setUrl(photo?.getURI({ maxWidth: 1200, maxHeight: 800 }) ?? null);
    }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [open, placeId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void Promise.all([loadMaps(), loadMarker()]).then(([{ Map: GoogleMap }, { Marker }]) => {
      if (!active || !mapRef.current) return;
      const position = { lat: latitude, lng: longitude };
      const map = new GoogleMap(mapRef.current, { center: position, zoom: 15, mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, gestureHandling: "cooperative" });
      new Marker({ map, position, title: name });
    });
    return () => { active = false; };
  }, [latitude, longitude, name, open]);

  return <dialog className="place-preview-dialog" ref={dialogRef} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="place-preview-card">
      <button className="place-preview-close" type="button" aria-label="Close place preview" onClick={() => dialogRef.current?.close()}><X size={21} /></button>
      <div className="place-preview-map" ref={mapRef} aria-label={`Map centered on ${name}`} />
      <div className="place-preview-details">
        <h2>{name}</h2>
        <div className={`place-preview-image${url ? " has-photo" : ""}`} role="img" aria-label={url ? `Google Maps photo of ${name}` : `No Google Maps photo available for ${name}`} style={url ? { backgroundImage: `url(${url})` } : undefined}>
          {!url ? <ImageIcon size={30} /> : null}
        </div>
      </div>
    </div>
  </dialog>;
}
