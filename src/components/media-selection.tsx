"use client";

import { Images, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useState } from "react";

import { refreshTrip } from "@/app/trip/[slug]/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

export type SelectableMoment =
  | { kind: "media"; id: string; storagePath: string; thumbnailStoragePath: string | null }
  | { kind: "checkin"; id: string };
type SelectionContextValue = { selected: Map<string, SelectableMoment>; selecting: boolean; toggle: (item: SelectableMoment) => void; clear: () => void };
const SelectionContext = createContext<SelectionContextValue | null>(null);

export function useMediaSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error("Media selection must be used inside MediaSelectionProvider.");
  return value;
}

export function MediaSelectionProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [selected, setSelected] = useState<Map<string, SelectableMoment>>(() => new Map());
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const clear = () => setSelected(new Map());
  const toggle = (item: SelectableMoment) => setSelected((current) => { const next = new Map(current); if (next.has(item.id)) next.delete(item.id); else next.set(item.id, item); return next; });
  const value = { selected, selecting: selected.size > 0, toggle, clear };

  async function deleteSelected() {
    const targets = [...selected.values()]; if (!targets.length) return;
    setDeleting(true); setError("");
    const mediaTargets = targets.filter((item) => item.kind === "media");
    const checkinTargets = targets.filter((item) => item.kind === "checkin");
    const { data: checkinMedia, error: attachmentError } = checkinTargets.length
      ? await supabase.from("media").select("storage_path,thumbnail_storage_path").in("checkin_id", checkinTargets.map((item) => item.id))
      : { data: [], error: null };
    if (attachmentError) { setDeleting(false); setConfirming(false); setError(attachmentError.message); return; }
    if (mediaTargets.length) {
      const { error: mediaDeleteError } = await supabase.from("media").delete().in("id", mediaTargets.map((item) => item.id));
      if (mediaDeleteError) { setDeleting(false); setConfirming(false); setError(mediaDeleteError.message); return; }
    }
    if (checkinTargets.length) {
      const { error: checkinDeleteError } = await supabase.from("checkins").delete().in("id", checkinTargets.map((item) => item.id));
      if (checkinDeleteError) { setDeleting(false); setConfirming(false); setError(checkinDeleteError.message); return; }
    }
    const paths = [
      ...mediaTargets.flatMap((item) => [item.storagePath, ...(item.thumbnailStoragePath ? [item.thumbnailStoragePath] : [])]),
      ...(checkinMedia ?? []).flatMap((item) => [item.storage_path, item.thumbnail_storage_path].filter((path): path is string => Boolean(path))),
    ];
    if (paths.length) await supabase.storage.from("trip-media").remove(paths);
    setDeleting(false); setConfirming(false); clear(); await refreshTrip(slug); router.refresh();
  }

  return <SelectionContext.Provider value={value}>{children}
    {selected.size ? <div className="selection-toolbar" role="toolbar" aria-label="Selected moments"><button type="button" aria-label="Clear selection" onClick={clear}><X size={17} /></button><strong><Images size={16} /> {selected.size} selected</strong><button className="selection-delete" type="button" onClick={() => setConfirming(true)}><Trash2 size={16} /> Delete</button></div> : null}
    {error ? <p className="selection-error global-selection-error" role="alert">{error}</p> : null}
    <ConfirmDialog open={confirming} busy={deleting} title={`Delete ${selected.size} ${selected.size === 1 ? "moment" : "moments"}?`} description="The selected check-ins, photos, or videos and their related activity will be permanently removed." onCancel={() => setConfirming(false)} onConfirm={() => void deleteSelected()} />
  </SelectionContext.Provider>;
}
