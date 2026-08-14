"use client";

import { Images, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, ReactNode, useContext, useState } from "react";

import { refreshTrip } from "@/app/trip/[slug]/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

export type SelectableMoment = { id: string; storagePath: string; thumbnailStoragePath: string | null };
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
    const { error: deleteError } = await supabase.from("media").delete().in("id", targets.map((item) => item.id));
    if (deleteError) { setDeleting(false); setConfirming(false); setError(deleteError.message); return; }
    await supabase.storage.from("trip-media").remove(targets.flatMap((item) => [item.storagePath, ...(item.thumbnailStoragePath ? [item.thumbnailStoragePath] : [])]));
    setDeleting(false); setConfirming(false); clear(); await refreshTrip(slug); router.refresh();
  }

  return <SelectionContext.Provider value={value}>{children}
    {selected.size ? <div className="selection-toolbar" role="toolbar" aria-label="Selected moments"><button type="button" aria-label="Clear selection" onClick={clear}><X size={17} /></button><strong><Images size={16} /> {selected.size} selected</strong><button className="selection-delete" type="button" onClick={() => setConfirming(true)}><Trash2 size={16} /> Delete</button></div> : null}
    {error ? <p className="selection-error global-selection-error" role="alert">{error}</p> : null}
    <ConfirmDialog open={confirming} busy={deleting} title={`Delete ${selected.size} ${selected.size === 1 ? "moment" : "moments"}?`} description="The selected photos or videos, their comments, and their reactions will be permanently removed." onCancel={() => setConfirming(false)} onConfirm={() => void deleteSelected()} />
  </SelectionContext.Provider>;
}
