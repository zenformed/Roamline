"use client";

import { LoaderCircle, MapPin, Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useRef, useState } from "react";

import { refreshTrip } from "@/app/trip/[slug]/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MapFocusButton } from "@/components/journey-map";
import { PlaceSearch, SelectedPlace } from "@/components/place-search";
import { PlaceThumbnail } from "@/components/place-thumbnail";
import { createClient } from "@/lib/supabase/client";

type Checkin = { id: string; placeId: string | null; placeName: string; address: string | null; note: string | null; occurredAt: string; latitude: number; longitude: number };
function localDateTime(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export function CheckinCard({ checkin, canManage, slug }: { checkin: Checkin; canManage: boolean; slug: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [place, setPlace] = useState({ id: checkin.placeId ?? "", name: checkin.placeName, address: checkin.address ?? "", latitude: String(checkin.latitude), longitude: String(checkin.longitude) });
  const selectPlace = useCallback((next: SelectedPlace) => setPlace({ ...next, latitude: String(next.latitude), longitude: String(next.longitude) }), []);
  async function refresh() { await refreshTrip(slug); router.refresh(); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const { error: updateError } = await supabase.from("checkins").update({ place_id: place.id || null, place_name: place.name.trim(), formatted_address: place.address.trim() || null, latitude: Number(place.latitude), longitude: Number(place.longitude), occurred_at: new Date(String(form.get("occurredAt"))).toISOString(), note: String(form.get("note") || "").trim() || null }).eq("id", checkin.id);
    setBusy(false); if (updateError) { setError(updateError.message); return; } dialogRef.current?.close(); await refresh();
  }

  async function remove() {
    setBusy(true); setError("");
    const { data: attachments } = await supabase.from("media").select("storage_path").eq("checkin_id", checkin.id);
    const { error: deleteError } = await supabase.from("checkins").delete().eq("id", checkin.id);
    setBusy(false);
    if (deleteError) { setError(deleteError.message); setConfirmingDelete(false); dialogRef.current?.showModal(); return; }
    if (attachments?.length) await supabase.storage.from("trip-media").remove(attachments.map((item) => item.storage_path));
    setConfirmingDelete(false); await refresh();
  }

  return <>
    <article className="checkin-card" id={`checkin-${checkin.id}`}>
      <PlaceThumbnail placeId={checkin.placeId} name={checkin.placeName} />
      <div><span className="moment-time">{new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(checkin.occurredAt))} · CHECK-IN</span><h3>{checkin.placeName}</h3>{checkin.note ? <p>{checkin.note}</p> : null}</div>
      <div className="moment-actions"><MapFocusButton pointId={checkin.id}><MapPin size={15} /> Show on map</MapFocusButton>{canManage ? <><button className="checkin-focus" type="button" onClick={() => dialogRef.current?.showModal()}><Pencil size={14} /> Edit</button><button className="checkin-focus danger" type="button" disabled={busy} onClick={() => setConfirmingDelete(true)}><Trash2 size={14} /> Delete</button></> : null}</div>
    </article>
    <ConfirmDialog open={confirmingDelete} busy={busy} title={`Delete ${checkin.placeName}?`} description="This check-in and any photos or videos attached to it will be permanently removed." onCancel={() => setConfirmingDelete(false)} onConfirm={() => void remove()} />
    {canManage ? <dialog className="moment-dialog edit-dialog" ref={dialogRef}><div className="dialog-head"><div><span className="section-kicker">CHECK-IN</span><h2>Edit moment</h2></div><button className="icon-button" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={19} /></button></div><form className="checkin-form" onSubmit={save}><label><span>Find a different place</span><PlaceSearch onSelect={selectPlace} /></label><label><span>Place name</span><input required maxLength={180} value={place.name} onChange={(event) => setPlace((current) => ({ ...current, id: "", name: event.target.value }))} /></label><label><span>Address</span><input value={place.address} onChange={(event) => setPlace((current) => ({ ...current, id: "", address: event.target.value }))} /></label><div className="coordinate-grid"><label><span>Latitude</span><input required type="number" min="-90" max="90" step="any" value={place.latitude} onChange={(event) => setPlace((current) => ({ ...current, id: "", latitude: event.target.value }))} /></label><label><span>Longitude</span><input required type="number" min="-180" max="180" step="any" value={place.longitude} onChange={(event) => setPlace((current) => ({ ...current, id: "", longitude: event.target.value }))} /></label></div><label><span>Date and time</span><input name="occurredAt" required type="datetime-local" defaultValue={localDateTime(checkin.occurredAt)} /></label><label><span>Note (optional)</span><textarea name="note" maxLength={1200} defaultValue={checkin.note ?? ""} /></label>{error ? <p className="form-message error" role="alert">{error}</p> : null}<button className="primary-button publish-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Pencil size={16} />} Save changes</button></form></dialog> : null}
  </>;
}
