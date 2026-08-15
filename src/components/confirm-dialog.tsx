"use client";

import { LoaderCircle, Share2, Trash2, X } from "lucide-react";
import { useEffect, useRef } from "react";

type Props = { open: boolean; title: string; description: string; busy?: boolean; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; busyLabel?: string; onCancel: () => void; onConfirm: () => void };

export function ConfirmDialog({ open, title, description, busy = false, confirmLabel = "Delete", cancelLabel = "Keep it", destructive = true, busyLabel = destructive ? "Deleting…" : "Working…", onCancel, onConfirm }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog className="confirm-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
    <button className="confirm-close" type="button" aria-label="Close confirmation" disabled={busy} onClick={onCancel}><X size={17} /></button>
    <div className={`confirm-icon${destructive ? "" : " is-neutral"}`}>{destructive ? <Trash2 size={22} /> : <Share2 size={22} />}</div><span className="section-kicker">PLEASE CONFIRM</span><h2>{title}</h2><p>{description}</p>
    <div className="confirm-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>{cancelLabel}</button><button className={destructive ? "danger-button" : "primary-button"} type="button" disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className="spin" size={16} /> : destructive ? <Trash2 size={16} /> : <Share2 size={16} />} {busy ? busyLabel : confirmLabel}</button></div>
  </dialog>;
}
