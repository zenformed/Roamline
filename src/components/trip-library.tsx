"use client";

import { useEffect, useState } from "react";

export function TripLibrary({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  useEffect(() => { const update = (event: Event) => setQuery((event as CustomEvent<string>).detail.trim().toLowerCase()); window.addEventListener("roamline-trip-search", update); return () => window.removeEventListener("roamline-trip-search", update); }, []);
  const items = Array.isArray(children) ? children : [children];
  const visible = items.filter((child) => !query || (child && typeof child === "object" && "props" in child && String((child.props as { "data-trip-name"?: string })["data-trip-name"] ?? "").toLowerCase().includes(query)));
  return visible.length ? <div className="journey-showcase-list">{visible}</div> : <div className="library-state search-empty"><h3>No matching trips</h3><p>Try another trip name.</p></div>;
}
