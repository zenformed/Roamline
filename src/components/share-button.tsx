"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Share2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

type Props = { title: string; menuItem?: boolean; tripId?: string; visibility?: string; canEnableLinkSharing?: boolean };

export function ShareButton({ title, menuItem = false, tripId, visibility, canEnableLinkSharing = false }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openShareSheet() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    setError("");
    if (visibility === "private") {
      if (!tripId || !canEnableLinkSharing) { setError("Only the trip owner can enable view-only sharing for a private trip."); return; }
      setConfirming(true);
      return;
    }
    await openShareSheet();
  }

  async function enableAndShare() {
    if (!tripId) return;
    setBusy(true); setError("");
    const { error: updateError } = await supabase.from("trips").update({ visibility: "unlisted" }).eq("id", tripId);
    setBusy(false);
    if (updateError) { setError("Could not enable link sharing. Try again."); return; }
    setConfirming(false);
    router.refresh();
    await openShareSheet();
  }

  return <>
    <button className={menuItem ? "header-menu-action" : "primary-button"} onClick={() => void share()} type="button">{copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? "Copied" : "Share"}</button>
    {error ? <p className="header-menu-error" role="alert">{error}</p> : null}
    <ConfirmDialog open={confirming} busy={busy} destructive={false} title="Share this private trip?" description="Anyone with this link will be able to view this private trip. They will not be able to add or edit anything." confirmLabel="Enable link sharing" cancelLabel="Cancel" busyLabel="Enabling…" onCancel={() => setConfirming(false)} onConfirm={() => void enableAndShare()} />
  </>;
}
