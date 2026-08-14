"use client";

import { LocateFixed, LoaderCircle, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { loadGeocoding, loadPlaces } from "@/lib/google-maps";

export type SelectedPlace = { id: string; name: string; address: string; latitude: number; longitude: number };

export function PlaceSearch({ onSelect, placeholder = "Try “Eorzea Cafe Akihabara”", showCurrentLocation = true, compact = false, initialQuery = "" }: { onSelect: (place: SelectedPlace) => void; placeholder?: string; showCurrentLocation?: boolean; compact?: boolean; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [message, setMessage] = useState("Search for a restaurant, landmark, hotel, or address.");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const skipNextSearchRef = useRef(Boolean(initialQuery));

  useEffect(() => {
    const text = query.trim();
    if (skipNextSearchRef.current) { skipNextSearchRef.current = false; return; }
    if (text.length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void loadPlaces().then(async ({ AutocompleteSessionToken, AutocompleteSuggestion }) => {
        if (!sessionRef.current) sessionRef.current = new AutocompleteSessionToken();
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: text, sessionToken: sessionRef.current });
        if (!active) return;
        setSuggestions(response.suggestions);
        setSearching(false);
        setMessage(response.suggestions.length ? "Choose a result below." : "No matching places found. Try a city or fuller address.");
      }).catch(() => { if (active) { setSearching(false); setSuggestions([]); setMessage("Place suggestions could not load. Check that Places API (New) is enabled."); } });
    }, 280);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query]);

  async function selectSuggestion(suggestion: google.maps.places.AutocompleteSuggestion) {
    const prediction = suggestion.placePrediction;
    if (!prediction) return;
    setSearching(true);
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location"] });
      if (!place.location) throw new Error("No location returned");
      const result = { id: place.id, name: place.displayName ?? prediction.mainText?.toString() ?? prediction.text.toString(), address: place.formattedAddress ?? prediction.text.toString(), latitude: place.location.lat(), longitude: place.location.lng() };
      onSelect(result);
      skipNextSearchRef.current = true;
      setQuery(result.name);
      setSuggestions([]);
      sessionRef.current = null;
      setMessage(result.address);
    } catch { setMessage("That result did not return a usable map location. Try another result."); }
    setSearching(false);
  }

  async function selectCurrentLocation() {
    if (!navigator.geolocation) { setMessage("This browser does not support location. Search for the place instead."); return; }
    setLocating(true); setMessage("Finding your location…");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const { Geocoder } = await loadGeocoding();
        const result = await new Geocoder().geocode({ location: { lat: coords.latitude, lng: coords.longitude } });
        const nearest = result.results[0];
        const place = { id: nearest?.place_id ?? "", name: nearest?.address_components[0]?.long_name ?? "Current location", address: nearest?.formatted_address ?? "", latitude: coords.latitude, longitude: coords.longitude };
        onSelect(place); skipNextSearchRef.current = true; setQuery(place.name); setMessage(place.address || "Current location selected.");
      } catch { setMessage("Your coordinates were found, but the address could not be loaded."); onSelect({ id: "", name: "Current location", address: "", latitude: coords.latitude, longitude: coords.longitude }); }
      setLocating(false);
    }, () => { setLocating(false); setMessage("Location permission was denied or unavailable. Search for the place instead."); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  return <div className={`place-search-block${compact ? " compact-place-search" : ""}`}>
    <div className="place-input-wrap"><MapPin size={15} /><input aria-label="Search places" autoComplete="off" placeholder={placeholder} value={query} onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length < 2) { setSuggestions([]); setSearching(false); } }} />{searching ? <LoaderCircle className="spin" size={15} /> : null}</div>
    {suggestions.length ? <div className="place-suggestions" role="listbox" aria-label="Place suggestions">{suggestions.map((suggestion, index) => <button key={`${suggestion.placePrediction?.placeId ?? "result"}-${index}`} type="button" role="option" aria-selected="false" onClick={() => void selectSuggestion(suggestion)}><MapPin size={14} /><span><strong>{suggestion.placePrediction?.mainText?.toString() ?? suggestion.placePrediction?.text.toString()}</strong><small>{suggestion.placePrediction?.secondaryText?.toString()}</small></span></button>)}</div> : null}
    {showCurrentLocation ? <button className="location-button" type="button" disabled={locating} onClick={() => void selectCurrentLocation()}>{locating ? <LoaderCircle className="spin" size={15} /> : <LocateFixed size={15} />} Use my current location</button> : null}
    {!compact ? <p className="place-help" role="status">{message}</p> : null}
  </div>;
}
