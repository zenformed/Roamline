"use client";

import { Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useRef, useState } from "react";

import { refreshTrip } from "@/app/trip/[slug]/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CompanionPicker } from "@/components/companion-picker";
import { useMediaSelection } from "@/components/media-selection";
import { PlaceSearch, SelectedPlace } from "@/components/place-search";
import { PlaceThumbnail } from "@/components/place-thumbnail";
import { createClient } from "@/lib/supabase/client";

type Checkin = { id: string; placeId: string | null; placeName: string; address: string | null; note: string | null; occurredAt: string; latitude: number; longitude: number };
type Traveler = { id: string; display_name: string };
function localDateTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function initials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); return `${parts[0]?.[0] ?? "T"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase(); }

export function CheckinCard({ checkin, canManage, slug, postStyle = false, authorId, authorName = "Traveler", authorColor = "#dce8ff", travelers = [], attendeeIds = [] }: { checkin: Checkin; canManage: boolean; slug: string; postStyle?: boolean; authorId: string; authorName?: string; authorColor?: string; travelers?: Traveler[]; attendeeIds?: string[] }) {
  const router = useRouter();
  const { selected, selecting, toggle } = useMediaSelection();
  const [supabase] = useState(() => createClient());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState(attendeeIds);
  const pressTimerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  const [place, setPlace] = useState({ id: checkin.placeId ?? "", name: checkin.placeName, address: checkin.address ?? "", latitude: String(checkin.latitude), longitude: String(checkin.longitude) });
  const selectPlace = useCallback((next: SelectedPlace) => setPlace({ ...next, latitude: String(next.latitude), longitude: String(next.longitude) }), []);
  async function refresh() { await refreshTrip(slug); router.refresh(); }
  const selectionItem = { kind: "checkin" as const, id: checkin.id };
  function isMobile() { return window.matchMedia("(max-width: 800px)").matches; }
  function beginPress(event: React.PointerEvent<HTMLElement>) {
    if (!canManage || !isMobile() || (event.target as HTMLElement).closest("button")) return;
    longPressedRef.current = false;
    pressTimerRef.current = window.setTimeout(() => { longPressedRef.current = true; toggle(selectionItem); if (navigator.vibrate) navigator.vibrate(25); }, 520);
  }
  function endPress() { if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
  function activateCard(event: React.MouseEvent<HTMLElement>) {
    if (!canManage || !isMobile() || (event.target as HTMLElement).closest("button")) return;
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    if (selecting) toggle(selectionItem); else dialogRef.current?.showModal();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const { error: updateError } = await supabase.from("checkins").update({ place_id: place.id || null, place_name: place.name.trim(), formatted_address: place.address.trim() || null, latitude: Number(place.latitude), longitude: Number(place.longitude), occurred_at: new Date(String(form.get("occurredAt"))).toISOString(), note: String(form.get("note") || "").trim() || null }).eq("id", checkin.id);
    if (updateError) { setBusy(false); setError(updateError.message); return; }
    const { error: removeAttendeeError } = await supabase.from("checkin_attendees").delete().eq("checkin_id", checkin.id);
    const { error: addAttendeeError } = selectedAttendeeIds.length ? await supabase.from("checkin_attendees").insert(selectedAttendeeIds.map((userId) => ({ checkin_id: checkin.id, user_id: userId }))) : { error: null };
    setBusy(false); if (removeAttendeeError || addAttendeeError) { setError("The check-in was saved, but its companions could not be updated."); return; } dialogRef.current?.close(); await refresh();
  }

  const companionNames = selectedAttendeeIds.map((id) => travelers.find((traveler) => traveler.id === id)?.display_name).filter((name): name is string => Boolean(name));

  async function remove() {
    setBusy(true); setError("");
    const { data: attachments } = await supabase.from("media").select("storage_path,thumbnail_storage_path").eq("checkin_id", checkin.id);
    const { error: deleteError } = await supabase.from("checkins").delete().eq("id", checkin.id);
    setBusy(false);
    if (deleteError) { setError(deleteError.message); setConfirmingDelete(false); dialogRef.current?.showModal(); return; }
    if (attachments?.length) await supabase.storage.from("trip-media").remove(attachments.flatMap((item) => [item.storage_path, item.thumbnail_storage_path].filter((path): path is string => Boolean(path))));
    setConfirmingDelete(false); await refresh();
  }

  return <>
    <article className={`checkin-card${postStyle ? " post-checkin" : ""}${canManage ? " can-manage" : ""}${selected.has(checkin.id) ? " is-selected" : ""}`} id={`checkin-${checkin.id}`} onPointerDown={beginPress} onPointerUp={endPress} onPointerCancel={endPress} onPointerLeave={endPress} onClick={activateCard}>
      {postStyle ? <div className="post-checkin-main"><span className="post-avatar" style={{ backgroundColor: authorColor }}>{initials(authorName)}</span><div><p className="post-byline"><strong>{authorName}</strong>{companionNames.length ? <> is with <strong>{companionNames[0]}</strong>{companionNames.length > 1 ? <> and <span title={companionNames.slice(1).join(", ")}>{companionNames.length - 1} {companionNames.length === 2 ? "other" : "others"}</span></> : null} at </> : <> is at </>}<button type="button" onClick={() => window.dispatchEvent(new CustomEvent("roamline:focus-map", { detail: checkin.id }))}>{checkin.placeName}</button></p><time>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(checkin.occurredAt))}</time>{checkin.note ? <p className="post-checkin-note">{checkin.note}</p> : null}</div></div> : <div className="checkin-main"><button className="place-thumbnail-button" type="button" aria-label={`Show ${checkin.placeName} on map`} title="Show on map" onClick={() => window.dispatchEvent(new CustomEvent("roamline:focus-map", { detail: checkin.id }))}><PlaceThumbnail placeId={checkin.placeId} name={checkin.placeName} /></button><div className="checkin-copy"><span className="moment-time">{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(checkin.occurredAt))} · CHECK-IN</span><h3>{checkin.placeName}</h3>{checkin.note ? <p>{checkin.note}</p> : null}</div></div>}
      {canManage ? <div className="moment-actions"><button className="checkin-focus" type="button" aria-label="Edit check-in" title="Edit check-in" onClick={() => dialogRef.current?.showModal()}><Pencil size={14} /><span className="checkin-action-label">Edit</span></button><button className="checkin-focus danger" type="button" aria-label="Delete check-in" title="Delete check-in" disabled={busy} onClick={() => setConfirmingDelete(true)}><Trash2 size={14} /><span className="checkin-action-label">Delete</span></button></div> : null}
      {canManage && selecting ? <button className="checkin-select-indicator" type="button" aria-label={selected.has(checkin.id) ? "Deselect check-in" : "Select check-in"} onClick={() => toggle(selectionItem)}>{selected.has(checkin.id) ? <Check size={15} strokeWidth={3} /> : null}</button> : null}
    </article>
    <ConfirmDialog open={confirmingDelete} busy={busy} title={`Delete ${checkin.placeName}?`} description="This check-in and any photos or videos attached to it will be permanently removed." onCancel={() => setConfirmingDelete(false)} onConfirm={() => void remove()} />
    {canManage ? <dialog className="moment-dialog edit-dialog" ref={dialogRef}><div className="dialog-head"><div><span className="section-kicker">CHECK-IN</span><h2>Edit moment</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={19} /></button></div><form className="checkin-form" onSubmit={save}><label><span>Find a different place</span><PlaceSearch onSelect={selectPlace} /></label><label><span>Place name</span><input required maxLength={180} value={place.name} onChange={(event) => setPlace((current) => ({ ...current, id: "", name: event.target.value }))} /></label><label><span>Address</span><input value={place.address} onChange={(event) => setPlace((current) => ({ ...current, id: "", address: event.target.value }))} /></label><div className="coordinate-grid"><label><span>Latitude</span><input required type="number" min="-90" max="90" step="any" value={place.latitude} onChange={(event) => setPlace((current) => ({ ...current, id: "", latitude: event.target.value }))} /></label><label><span>Longitude</span><input required type="number" min="-180" max="180" step="any" value={place.longitude} onChange={(event) => setPlace((current) => ({ ...current, id: "", longitude: event.target.value }))} /></label></div><label><span>Date and time</span><input name="occurredAt" required type="datetime-local" defaultValue={localDateTime(checkin.occurredAt)} /></label><label><span>Note (optional)</span><textarea name="note" maxLength={1200} defaultValue={checkin.note ?? ""} /></label>{travelers.some((traveler) => traveler.id !== authorId) ? <CompanionPicker label="Who was there?" travelers={travelers.filter((traveler) => traveler.id !== authorId)} selectedIds={selectedAttendeeIds} onChange={setSelectedAttendeeIds} /> : null}{error ? <p className="form-message error" role="alert">{error}</p> : null}<button className="primary-button publish-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Pencil size={16} />} Save changes</button></form></dialog> : null}
  </>;
}
