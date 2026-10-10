"use client";

import { LoaderCircle, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";

import { deleteDaySummary, saveDaySummary } from "@/app/trip/[slug]/actions";

type Summary = { id: string; authorId: string; authorName: string; body: string; summaryDate: string };
type Props = { tripId: string; slug: string; date: string; summaries: Summary[]; canContribute: boolean; canCreate: boolean; userId: string | null; userName: string | null };

export function DaySummary({ tripId, slug, date, summaries: initialSummaries, canContribute, canCreate, userId, userName }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const editingSummary = useMemo(
    () => initialSummaries.find((summary) => summary.id === editingSummaryId) ?? null,
    [editingSummaryId, initialSummaries]
  );
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !body.trim()) return;
    setBusy(true); setMessage("");
    const summaryDate = editingSummary?.summaryDate ?? date;
    const occurredAt = editingSummary
      ? undefined
      : new Date(`${date}T12:00:00`).toISOString();
    const result = await saveDaySummary(tripId, slug, summaryDate, body, occurredAt, editingSummary?.id);
    setBusy(false);
    if (!result.summary) { setMessage(result.error ?? "Your summary could not be saved."); return; }
    setMessage("Day summary saved."); dialogRef.current?.close(); router.refresh();
  }

  async function remove() {
    if (!editingSummary) return;
    setBusy(true); setMessage("");
    const result = await deleteDaySummary(editingSummary.id, slug);
    setBusy(false);
    if (!result.success) { setMessage(result.error ?? "This summary could not be removed."); return; }
    setMessage("Day summary removed."); dialogRef.current?.close(); router.refresh();
  }

  function openEditor(summary?: Summary) {
    setEditingSummaryId(summary?.id ?? null);
    setBody(summary?.body ?? "");
    setMessage("");
    dialogRef.current?.showModal();
  }

  if (!initialSummaries.length && !canCreate) return null;

  return <section className="day-summary">
    {initialSummaries.length ? <div className="day-summary-list">{initialSummaries.map((summary) => summary.authorId === userId && canContribute ? <button className="day-summary-body-button" type="button" key={summary.id} aria-label="Edit your day summary" onClick={() => openEditor(summary)}><p>{summary.body}</p></button> : <article key={summary.id}><p>{summary.body}</p></article>)}</div> : null}
    {canCreate ? <button className="day-summary-prompt" type="button" onClick={() => openEditor()}>Summarize Your Day</button> : null}
    {canContribute ? <dialog className="summary-dialog" ref={dialogRef} onClose={() => { setEditingSummaryId(null); setBody(""); }}><div className="summary-dialog-head"><div><span className="section-kicker">{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span><h2>Summarize Your Day</h2><p>{userName || "Traveler"}</p></div><button className="icon-button" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={20} /></button></div><form onSubmit={save}>
      <textarea aria-label="Day summary" autoFocus maxLength={2000} rows={7} placeholder="What made today memorable?" value={body} onChange={(event) => setBody(event.target.value)} />
      {message && !message.includes("saved") && !message.includes("removed") ? <p className="error" role="alert">{message}</p> : null}
      <div className="day-summary-actions"><button type="submit" aria-label={editingSummary ? "Save summary changes" : "Save summary"} title={editingSummary ? "Save changes" : "Save summary"} disabled={busy || !body.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}</button>{editingSummary ? <button className="day-summary-remove" type="button" aria-label="Delete day summary" title="Delete summary" disabled={busy} onClick={() => void remove()}><Trash2 size={17} /></button> : null}</div>
    </form></dialog> : null}
  </section>;
}
