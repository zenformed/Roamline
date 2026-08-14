"use client";

import { Check, Copy, LoaderCircle, UserPlus, X } from "lucide-react";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function InvitePeople({ tripId, userId }: { tripId: string; userId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [supabase] = useState(() => createClient());
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function createLink() {
    setBusy(true); setError(""); setCopied(false);
    const token = crypto.randomUUID();
    const { error: insertError } = await supabase.from("trip_invitations").insert({ trip_id: tripId, created_by: userId, token });
    setBusy(false);
    if (insertError) setError("Could not create an invitation. Try again.");
    else setLink(`${window.location.origin}/invite/${token}`);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return <><button className="text-button journey-action" type="button" onClick={() => dialogRef.current?.showModal()}><UserPlus size={16} /> Invite</button><dialog className="invite-dialog" ref={dialogRef}><div className="dialog-head"><div><span className="section-kicker">CONTRIBUTORS</span><h2>Invite someone</h2></div><button className="icon-button" type="button" aria-label="Close invitations" onClick={() => dialogRef.current?.close()}><X size={18} /></button></div><div className="invite-body"><p>Create a private contributor link. Anyone who accepts it can add moments to this trip.</p>{link ? <div className="invite-link"><input readOnly aria-label="Invitation link" value={link} /><button type="button" onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}</button></div> : <button className="primary-button" type="button" disabled={busy} onClick={() => void createLink()}>{busy ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />} Create invite link</button>}{error ? <p className="form-message error">{error}</p> : null}<small>Links expire after 30 days. Trip owners can revoke them later.</small></div></dialog></>;
}
