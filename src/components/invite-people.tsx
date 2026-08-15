"use client";

import { Check, Copy, LoaderCircle, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { createClient } from "@/lib/supabase/client";

type Collaborator = { id: string; displayName: string };
type Invitation = { id: string; token: string; expiresAt: string };

export function InvitePeople({ tripId, userId, collaborators: initialCollaborators = [], invitations: initialInvitations = [], menuItem = false, inline = false }: { tripId: string; userId: string; collaborators?: Collaborator[]; invitations?: Invitation[]; menuItem?: boolean; inline?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [supabase] = useState(() => createClient());
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [collaborators, setCollaborators] = useState(initialCollaborators);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [removeTarget, setRemoveTarget] = useState<Collaborator | null>(null);

  async function createLink() {
    setBusy(true); setError(""); setCopied(false);
    const token = crypto.randomUUID();
    const { data, error: insertError } = await supabase.from("trip_invitations").insert({ trip_id: tripId, created_by: userId, token }).select("id,token,expires_at").single();
    setBusy(false);
    if (insertError) setError("Could not create an invitation. Try again.");
    else { setLink(`${window.location.origin}/invite/${token}`); setInvitations((current) => [{ id: data.id, token: data.token, expiresAt: data.expires_at }, ...current]); }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  async function removeCollaborator(collaborator: Collaborator) {
    setBusy(true); setError("");
    const { error: removeError } = await supabase.rpc("remove_trip_contributor", { target_trip_id: tripId, target_user_id: collaborator.id });
    setBusy(false);
    if (removeError) { setError("Could not remove this person. Try again."); return; }
    setCollaborators((current) => current.filter((item) => item.id !== collaborator.id)); setRemoveTarget(null);
    router.refresh();
  }

  async function revokeInvitation(invitation: Invitation) {
    setBusy(true); setError("");
    const { error: revokeError } = await supabase.rpc("revoke_trip_invitation", { target_invitation_id: invitation.id });
    setBusy(false);
    if (revokeError) { setError("Could not revoke this invitation. Try again."); return; }
    setInvitations((current) => current.filter((item) => item.id !== invitation.id));
    if (link.endsWith(invitation.token)) setLink("");
  }

  const controls = <><p>Create a contributor link. Anyone who accepts it can add photos, videos, and check-ins to this trip.</p>{link ? <div className="invite-link"><input readOnly aria-label="Invitation link" value={link} /><button type="button" onClick={() => void copyLink()}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}</button></div> : <button className="primary-button" type="button" disabled={busy} onClick={() => void createLink()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Add People</button>}{error ? <p className="form-message error" role="alert">{error}</p> : null}<small>Contributor links expire after 30 days.</small><section className="people-management"><h3>People on this trip</h3>{collaborators.length ? collaborators.map((person) => <div className="people-management-row" key={person.id}><span>{person.displayName}</span><button type="button" disabled={busy} onClick={() => setRemoveTarget(person)}><Trash2 size={14} /> Remove</button></div>) : <p className="people-management-empty">No collaborators yet.</p>}</section>{invitations.length ? <section className="people-management"><h3>Active invitation links</h3>{invitations.map((invitation) => <div className="people-management-row" key={invitation.id}><span>Expires {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</span><button type="button" disabled={busy} onClick={() => void revokeInvitation(invitation)}><X size={14} /> Revoke</button></div>)}</section> : null}</>;
  const confirmation = <ConfirmDialog open={Boolean(removeTarget)} busy={busy} title={removeTarget ? `Remove ${removeTarget.displayName}?` : "Remove collaborator?"} description="They will immediately lose contributor access to this trip. Their existing photos, videos, and check-ins will remain." confirmLabel="Remove person" onCancel={() => setRemoveTarget(null)} onConfirm={() => { if (removeTarget) void removeCollaborator(removeTarget); }} />;

  if (inline) return <section className="field-wide collaborator-settings"><div className="collaborator-settings-head"><div><span className="section-kicker">COLLABORATORS</span><h2>People on this trip</h2></div><UserPlus size={19} /></div><div className="invite-body">{controls}</div>{confirmation}</section>;
  return <><button className={menuItem ? "header-menu-action" : "text-button journey-action"} type="button" onClick={() => dialogRef.current?.showModal()}><UserPlus size={16} /> Add people</button><dialog className="invite-dialog" ref={dialogRef}><div className="dialog-head"><div><span className="section-kicker">COLLABORATORS</span><h2>Add people</h2></div><button className="icon-button" type="button" aria-label="Close collaborator management" onClick={() => dialogRef.current?.close()}><X size={18} /></button></div><div className="invite-body">{controls}</div></dialog>{confirmation}</>;
}
