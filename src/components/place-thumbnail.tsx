"use client";

import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { loadPlaces } from "@/lib/google-maps";

export function PlaceThumbnail({ placeId, name }: { placeId: string | null; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!placeId) return;
    let active = true;
    void loadPlaces().then(async ({ Place }) => {
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ["photos"] });
      const photo = place.photos?.[0];
      if (active && photo) setUrl(photo.getURI({ maxWidth: 320, maxHeight: 220 }));
    }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; };
  }, [placeId]);
  return <div className={`place-thumbnail${url ? " has-photo" : ""}`} role="img" aria-label={url ? `Google Maps photo of ${name}` : `No place photo available for ${name}`} style={url ? { backgroundImage: `url(${url})` } : undefined}>{url ? null : <ImageIcon size={18} />}</div>;
}
