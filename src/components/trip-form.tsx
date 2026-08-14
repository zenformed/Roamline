"use client";

import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { updateTrip } from "@/app/trip/[slug]/edit/actions";
import { createTrip, type TripFormState } from "@/app/trips/new/actions";

const initialState: TripFormState = {};
type InitialTrip = { id: string; name: string; slug: string; description: string; startDate: string; endDate: string; visibility: string };
function toSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

export function TripForm({ mode = "create", initialData }: { mode?: "create" | "edit"; initialData?: InitialTrip }) {
  const [state, action, pending] = useActionState(mode === "edit" ? updateTrip : createTrip, initialState);
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  return <form action={action} className="trip-form">
    {initialData ? <><input type="hidden" name="tripId" value={initialData.id} /><input type="hidden" name="oldSlug" value={initialData.slug} /></> : null}
    <div className="form-grid">
      <label className="field-wide"><span>Trip name</span><input name="name" placeholder="Japan 2026" maxLength={120} required defaultValue={initialData?.name} onChange={(event) => { if (!slugTouched) setSlug(toSlug(event.target.value)); }} /></label>
      <label className="field-wide"><span>Public URL</span><div className="slug-input"><span>roamline.app/trip/</span><input name="slug" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(toSlug(event.target.value)); }} required /></div></label>
      <label><span>Starts</span><input name="startDate" type="date" defaultValue={initialData?.startDate} /></label>
      <label><span>Ends</span><input name="endDate" type="date" defaultValue={initialData?.endDate} /></label>
      <label className="field-wide"><span>Description</span><textarea name="description" rows={4} maxLength={1200} placeholder="A few words about this journey…" defaultValue={initialData?.description} /></label>
      <fieldset className="field-wide visibility-options"><legend>Who can see this trip?</legend>
        <label><input type="radio" name="visibility" value="public" defaultChecked={!initialData || initialData.visibility === "public"} /><span><strong>Public</strong><small>Anyone can follow the trip and it appears on your trip shelf.</small></span></label>
        <label><input type="radio" name="visibility" value="unlisted" defaultChecked={initialData?.visibility === "unlisted"} /><span><strong>Link only</strong><small>Anyone with the journey link can view it, but it stays off the public shelf.</small></span></label>
        <label><input type="radio" name="visibility" value="private" defaultChecked={initialData?.visibility === "private"} /><span><strong>Private</strong><small>Only invited contributors can view it.</small></span></label>
      </fieldset>
    </div>
    {state.error ? <p className="form-message error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><button className="primary-button" disabled={pending} type="submit">{pending ? <LoaderCircle className="spin" size={17} /> : null}{pending ? (mode === "edit" ? "Saving…" : "Creating…") : (mode === "edit" ? "Save changes" : "Create trip")}{!pending ? <ArrowRight size={17} /> : null}</button></div>
  </form>;
}
