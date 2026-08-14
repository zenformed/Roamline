import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configured = false;

function configure() {
  if (configured) return;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Google Maps is not configured.");
  setOptions({ key, v: "weekly", authReferrerPolicy: "origin" });
  configured = true;
}

export async function loadMaps() {
  configure();
  return importLibrary("maps") as Promise<google.maps.MapsLibrary>;
}

export async function loadPlaces() {
  configure();
  return importLibrary("places") as Promise<google.maps.PlacesLibrary>;
}

export async function loadGeocoding() {
  configure();
  return importLibrary("geocoding") as Promise<google.maps.GeocodingLibrary>;
}

export async function loadMarker() {
  configure();
  return importLibrary("marker") as Promise<google.maps.MarkerLibrary>;
}
