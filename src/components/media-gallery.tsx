"use client";

import { ChevronLeft, ChevronRight, LoaderCircle, MapPin, MessageCircle, Pencil, Save, Send, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { refreshTrip } from "@/app/trip/[slug]/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SelectableMediaGrid } from "@/components/selectable-media-grid";

type MediaItem = { id: string; storagePath: string; thumbnailStoragePath: string | null; url: string; thumbnailUrl: string; caption: string | null; kind: "photo" | "video"; capturedAt: string | null; placeName: string | null; latitude: number | null; longitude: number | null; reactions: string[]; canManage: boolean };
type CommentItem = { id: string; body: string; created_at: string; author_id: string; profiles: { display_name: string } | null };
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

export function MediaGallery({ items, userId, returnTo, slug }: { items: MediaItem[]; userId: string | null; returnTo: string; slug: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [reactions, setReactions] = useState<Array<{ user_id: string; emoji: string }>>([]);
  const [reactionOverrides, setReactionOverrides] = useState<Record<string, string[]>>({});
  const [mediaOverrides, setMediaOverrides] = useState<Record<string, Partial<MediaItem>>>({});
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [confirmingMedia, setConfirmingMedia] = useState(false);
  const [pendingComment, setPendingComment] = useState<CommentItem | null>(null);
  const activeBase = activeIndex === null ? null : items[activeIndex];
  const active = activeBase ? { ...activeBase, ...mediaOverrides[activeBase.id] } : null;
  const activeId = active?.id ?? null;

  useEffect(() => {
    if (!activeId) return;
    let current = true;
    void Promise.all([
      supabase.from("comments").select("id,body,created_at,author_id,profiles!comments_author_id_fkey(display_name)").eq("media_id", activeId).order("created_at"),
      supabase.from("reactions").select("user_id,emoji").eq("media_id", activeId),
    ]).then(([commentResult, reactionResult]) => {
      if (!current) return;
      if (commentResult.error || reactionResult.error) setError("Could not load reactions and comments.");
      setComments((commentResult.data ?? []) as unknown as CommentItem[]);
      const loadedReactions = reactionResult.data ?? [];
      setReactions(loadedReactions);
      setReactionOverrides((currentOverrides) => ({ ...currentOverrides, [activeId]: loadedReactions.map((reaction) => reaction.emoji) }));
      setLoading(false);
    });
    return () => { current = false; };
  }, [activeId, supabase]);

  function open(index: number) { setActiveIndex(index); setLoading(true); setEditing(false); setError(""); dialogRef.current?.showModal(); }
  function move(direction: -1 | 1) { if (activeIndex === null) return; setLoading(true); setActiveIndex((activeIndex + direction + items.length) % items.length); }

  async function react(emoji: string) {
    if (!active || !userId) return;
    const existing = reactions.find((reaction) => reaction.user_id === userId);
    const next = existing?.emoji === emoji ? reactions.filter((reaction) => reaction.user_id !== userId) : [...reactions.filter((reaction) => reaction.user_id !== userId), { user_id: userId, emoji }];
    setReactions(next); setReactionOverrides((current) => ({ ...current, [active.id]: next.map((reaction) => reaction.emoji) })); setError("");
    const result = existing?.emoji === emoji
      ? await supabase.from("reactions").delete().eq("media_id", active.id).eq("user_id", userId)
      : await supabase.from("reactions").upsert({ media_id: active.id, user_id: userId, emoji }, { onConflict: "media_id,user_id" });
    if (result.error) { setReactions(reactions); setReactionOverrides((current) => ({ ...current, [active.id]: reactions.map((reaction) => reaction.emoji) })); setError("Reaction could not be saved. Try again."); }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !userId) return;
    const form = event.currentTarget;
    const input = new FormData(form).get("comment")?.toString().trim();
    if (!input) return;
    setSending(true); setError("");
    const { data, error: submitError } = await supabase.from("comments").insert({ media_id: active.id, author_id: userId, body: input }).select("id,body,created_at,author_id,profiles!comments_author_id_fkey(display_name)").single();
    setSending(false);
    if (submitError) setError("Comment could not be posted. Try again.");
    else { setComments((current) => [...current, data as unknown as CommentItem]); form.reset(); }
  }

  async function deleteComment(comment: CommentItem) {
    if (!userId || comment.author_id !== userId) return;
    setPendingComment(comment);
  }

  async function confirmDeleteComment() {
    if (!userId || !pendingComment) return;
    const comment = pendingComment;
    const previous = comments;
    setComments((current) => current.filter((item) => item.id !== comment.id));
    const { error: deleteError } = await supabase.from("comments").delete().eq("id", comment.id).eq("author_id", userId);
    if (deleteError) { setComments(previous); setError("Comment could not be deleted. Try again."); }
    setPendingComment(null);
  }

  async function saveMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active?.canManage) return;
    const form = new FormData(event.currentTarget); setManaging(true); setError("");
    const capturedAt = String(form.get("capturedAt") || "");
    const changes = { caption: String(form.get("caption") || "").trim() || null, place_name: String(form.get("placeName") || "").trim() || null, captured_at: capturedAt ? new Date(capturedAt).toISOString() : null, latitude: form.get("latitude") ? Number(form.get("latitude")) : null, longitude: form.get("longitude") ? Number(form.get("longitude")) : null };
    const { error: updateError } = await supabase.from("media").update(changes).eq("id", active.id);
    setManaging(false);
    if (updateError) { setError(updateError.message); return; }
    setMediaOverrides((current) => ({ ...current, [active.id]: { caption: changes.caption, placeName: changes.place_name, capturedAt: changes.captured_at, latitude: changes.latitude, longitude: changes.longitude } }));
    setEditing(false); dialogRef.current?.close(); await refreshTrip(slug); router.refresh();
  }

  async function deleteMedia() {
    if (!active?.canManage) return;
    setConfirmingMedia(true);
  }

  async function confirmDeleteMedia() {
    if (!active?.canManage) return;
    setManaging(true); setError("");
    const { error: deleteError } = await supabase.from("media").delete().eq("id", active.id);
    if (deleteError) { setManaging(false); setConfirmingMedia(false); setError(deleteError.message); return; }
    const { error: storageError } = await supabase.storage.from("trip-media").remove([active.storagePath, ...(active.thumbnailStoragePath ? [active.thumbnailStoragePath] : [])]);
    if (storageError) setError("The moment was removed, but its stored file could not be cleaned up.");
    setConfirmingMedia(false); dialogRef.current?.close(); setManaging(false); await refreshTrip(slug); router.refresh();
  }

  const counts = EMOJIS.map((emoji) => ({ emoji, count: reactions.filter((reaction) => reaction.emoji === emoji).length }));

  const timelineItems = items.map((item) => ({ ...item, ...mediaOverrides[item.id], reactions: reactionOverrides[item.id] ?? item.reactions }));

  return <>
    <SelectableMediaGrid items={timelineItems} onOpen={open} />
    <dialog className="media-viewer" ref={dialogRef} onClose={() => setActiveIndex(null)} onKeyDown={(event) => { if (event.key === "ArrowLeft") move(-1); if (event.key === "ArrowRight") move(1); }}>
      {active ? <div className="viewer-layout"><div className="viewer-stage">{active.kind === "photo" ? <Image src={active.url} alt={active.caption || active.placeName || "Trip photo"} fill sizes="75vw" priority /> : <video src={active.url} controls autoPlay playsInline />}<button className="viewer-close" type="button" aria-label="Close viewer" onClick={() => dialogRef.current?.close()}><X size={20} /></button>{items.length > 1 ? <><button className="viewer-nav previous" type="button" aria-label="Previous media" onClick={() => move(-1)}><ChevronLeft size={22} /></button><button className="viewer-nav next" type="button" aria-label="Next media" onClick={() => move(1)}><ChevronRight size={22} /></button></> : null}</div><aside className="viewer-sidebar">
        {editing ? <form className="media-edit-form" onSubmit={saveMedia}><span className="section-kicker">EDIT MOMENT</span><label><span>Title or caption</span><input name="caption" maxLength={500} defaultValue={active.caption ?? ""} /></label><label><span>Place</span><input name="placeName" maxLength={180} defaultValue={active.placeName ?? ""} /></label><label><span>Date and time</span><input name="capturedAt" type="datetime-local" defaultValue={active.capturedAt ? new Date(new Date(active.capturedAt).getTime() - new Date(active.capturedAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ""} /></label><div className="coordinate-grid"><label><span>Latitude</span><input name="latitude" type="number" min="-90" max="90" step="any" defaultValue={active.latitude ?? ""} /></label><label><span>Longitude</span><input name="longitude" type="number" min="-180" max="180" step="any" defaultValue={active.longitude ?? ""} /></label></div><div className="editor-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" disabled={managing}>{managing ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save</button></div></form> : <><div><div className="viewer-title-row"><span className="section-kicker">MOMENT {activeIndex! + 1} OF {items.length}</span>{active.canManage ? <div><button type="button" aria-label="Edit moment" onClick={() => setEditing(true)}><Pencil size={15} /></button><button type="button" aria-label="Delete moment" disabled={managing} onClick={() => void deleteMedia()}><Trash2 size={15} /></button></div> : null}</div><h2>{active.caption || "Untitled moment"}</h2>{active.placeName ? <p className="viewer-place"><MapPin size={14} /> {active.placeName}</p> : null}{active.capturedAt ? <p className="viewer-date">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(active.capturedAt))}</p> : null}</div><div className="reaction-row">{counts.map(({ emoji, count }) => userId ? <button type="button" className={reactions.some((reaction) => reaction.user_id === userId && reaction.emoji === emoji) ? "active" : ""} key={emoji} onClick={() => void react(emoji)}><span>{emoji}</span>{count ? <small>{count}</small> : null}</button> : count ? <span className="reaction-count" key={emoji}>{emoji} {count}</span> : null)}</div><section className="comments"><h3><MessageCircle size={15} /> Comments <span>{comments.length}</span></h3>{loading ? <div className="comments-loading"><LoaderCircle className="spin" size={18} /></div> : comments.length ? <div className="comment-list">{comments.map((comment) => <article key={comment.id}><div className="comment-head"><strong>{comment.profiles?.display_name || "Traveler"}</strong>{comment.author_id === userId ? <button type="button" aria-label="Delete comment" onClick={() => void deleteComment(comment)}><Trash2 size={13} /></button> : null}</div><p>{comment.body}</p><time>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(comment.created_at))}</time></article>)}</div> : <p className="comments-empty">No comments yet.</p>}{userId ? <form className="comment-form" onSubmit={addComment}><input name="comment" required maxLength={1200} aria-label="Add a comment" placeholder="Add a comment…" /><button type="submit" disabled={sending} aria-label="Post comment">{sending ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}</button></form> : <Link className="comment-login" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in to react or comment</Link>}</section></>}{error ? <p className="viewer-error" role="alert">{error}</p> : null}
      </aside></div> : null}
    </dialog>
    <ConfirmDialog open={confirmingMedia} busy={managing} title="Delete this moment?" description="The photo or video, its comments, and its reactions will be permanently removed." onCancel={() => setConfirmingMedia(false)} onConfirm={() => void confirmDeleteMedia()} />
    <ConfirmDialog open={Boolean(pendingComment)} title="Delete this comment?" description="This comment will be permanently removed from the conversation." confirmLabel="Delete comment" onCancel={() => setPendingComment(null)} onConfirm={() => void confirmDeleteComment()} />
  </>;
}
