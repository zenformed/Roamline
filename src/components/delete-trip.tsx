"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

type Props = { tripId: string; tripName: string; ownerId: string };

export function DeleteTrip({ tripId, tripName, ownerId }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function removeTrip() {
    setDeleting(true);
    setError("");
    const { data: media, error: mediaError } = await supabase.from("media").select("storage_path").eq("trip_id", tripId);
    if (mediaError) {
      setDeleting(false); setConfirming(false); setError("Roamline could not prepare this trip for deletion. Please try again."); return;
    }
    const paths = (media ?? []).map((item) => item.storage_path).filter(Boolean);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from("trip-media").remove(paths);
      if (storageError) {
        setDeleting(false); setConfirming(false); setError("The trip was kept because its uploaded files could not be removed. Please try again."); return;
      }
    }
    const { error: deleteError } = await supabase.from("trips").delete().eq("id", tripId).eq("owner_id", ownerId);
    if (deleteError) {
      setDeleting(false); setConfirming(false); setError("The trip could not be deleted. Please try again."); return;
    }
    router.replace("/?scope=mine");
    router.refresh();
  }

  return <section className="trip-danger-zone" aria-labelledby="delete-trip-heading">
    <div><p className="section-kicker">DANGER ZONE</p><h2 id="delete-trip-heading">Delete this trip</h2><p>Remove the journey, every check-in, photo, video, comment, reaction, and invitation permanently.</p></div>
    <button className="trip-delete-button" type="button" onClick={() => setConfirming(true)}><Trash2 size={16} /> Delete trip</button>
    {error ? <p className="form-message error trip-delete-error" role="alert">{error}</p> : null}
    <ConfirmDialog open={confirming} busy={deleting} title={`Delete ${tripName}?`} description="This permanently deletes the entire trip and everything shared inside it. This cannot be undone." confirmLabel="Delete trip" onCancel={() => setConfirming(false)} onConfirm={() => void removeTrip()} />
  </section>;
}
