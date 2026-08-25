"use client";

import { Check, Search, UserPlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Traveler = { id: string; display_name: string };
type Props = { travelers: Traveler[]; selectedIds: string[]; onChange: (ids: string[]) => void; label?: string; compact?: boolean };

const COLORS = ["#dce8ff", "#ffe0da", "#dff1e5", "#eee1ff", "#fff0c7", "#d9eef2", "#f3ddea", "#e7e5d5"];
function initials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); return `${parts[0]?.[0] ?? "T"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase(); }
function colorFor(id: string) { return COLORS[[...id].reduce((sum, character) => sum + character.charCodeAt(0), 0) % COLORS.length]; }

export function CompanionPicker({ travelers, selectedIds, onChange, label = "Who are you with?", compact = false }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const selected = travelers.filter((traveler) => selectedIds.includes(traveler.id));
  const results = useMemo(() => travelers.filter((traveler) => traveler.display_name.toLowerCase().includes(query.trim().toLowerCase())), [query, travelers]);
  function toggle(id: string) { onChange(selectedIds.includes(id) ? selectedIds.filter((selectedId) => selectedId !== id) : [...selectedIds, id]); }

  return <section className={`companion-field${compact ? " is-compact" : ""}`}>
    {!compact ? <span>{label}</span> : null}
    <button className="companion-open" type="button" aria-label={selected.length ? `Edit people · ${selected.length} selected` : "Add people"} title="Add people" onClick={() => { setQuery(""); dialogRef.current?.showModal(); }}><UserPlus size={compact ? 22 : 16} />{compact ? (selected.length ? <b>{selected.length}</b> : null) : selected.length ? selected.map((traveler) => traveler.display_name).join(", ") : "Add people"}</button>
    {!compact && selected.length ? <div className="companion-chips">{selected.map((traveler) => <span key={traveler.id}><i style={{ backgroundColor: colorFor(traveler.id) }}>{initials(traveler.display_name)}</i>{traveler.display_name}<button type="button" aria-label={`Remove ${traveler.display_name}`} onClick={() => toggle(traveler.id)}><X size={12} /></button></span>)}</div> : null}
    <dialog className="companion-dialog" ref={dialogRef} onClose={() => setQuery("")}>
      <div className="companion-dialog-head"><h2>Add people</h2><button type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={19} /></button></div>
      <label className="companion-search"><Search size={16} /><input autoFocus type="search" placeholder="Search collaborators" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="companion-results"><span>Collaborators</span>{results.length ? results.map((traveler) => { const isSelected = selectedIds.includes(traveler.id); return <button type="button" className={isSelected ? "is-selected" : ""} key={traveler.id} onClick={() => toggle(traveler.id)}><i style={{ backgroundColor: colorFor(traveler.id) }}>{initials(traveler.display_name)}</i><strong>{traveler.display_name}</strong><b>{isSelected ? <Check size={15} strokeWidth={3} /> : null}</b></button>; }) : <p>No collaborators found.</p>}</div>
      <button className="companion-done" type="button" onClick={() => dialogRef.current?.close()}>Done{selectedIds.length ? ` · ${selectedIds.length} selected` : ""}</button>
    </dialog>
  </section>;
}
