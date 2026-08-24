"use client";

import { LoaderCircle, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useRef, useState } from "react";

import { deleteDaySummary, saveDaySummary } from "@/app/trip/[slug]/actions";

type Summary = { id: string; authorId: string; authorName: string; body: string };
type Props = { tripId: string; slug: string; date: string; summaries: Summary[]; canContribute: boolean; userId: string | null; userName: string | null };

export function DaySummary({ tripId, slug, date, summaries: initialSummaries, canContribute, userId, userName }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [summaries, setSummaries] = useState(initialSummaries);
  const ownSummary = useMemo(() => summaries.find((summary) => summary.authorId === userId) ?? null, [summaries, userId]);
  const [body, setBody] = useState(ownSummary?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !body.trim()) return;
    setBusy(true); setMessage("");
    const result = await saveDaySummary(tripId, slug, date, body);
    setBusy(false);
    if (!result.summary) { setMessage(result.error ?? "Your summary could not be saved."); return; }
    const saved = { id: result.summary.id, authorId: userId, authorName: userName || "Traveler", body: result.summary.body };
    setSummaries((current) => [...current.filter((summary) => summary.authorId !== userId), saved]);
    setBody(saved.body); setMessage("Day summary saved."); dialogRef.current?.close(); router.refresh();
  }

  async function remove() {
    if (!ownSummary) return;
    setBusy(true); setMessage("");
    const result = await deleteDaySummary(ownSummary.id, slug);
    setBusy(false);
    if (!result.success) { setMessage(result.error ?? "This summary could not be removed."); return; }
    setSummaries((current) => current.filter((summary) => summary.id !== ownSummary.id));
    setBody(""); setMessage("Day summary removed."); dialogRef.current?.close(); router.refresh();
  }

  if (!canContribute && !summaries.length) return null;

  return <section className="day-summary">
    {summaries.length ? <div className="day-summary-list">{summaries.map((summary) => summary.authorId === userId && canContribute ? <button className="day-summary-body-button" type="button" key={summary.id} aria-label="Edit your day summary" onClick={() => dialogRef.current?.showModal()}><p>{summary.body}</p></button> : <article key={summary.id}><p>{summary.body}</p></article>)}</div> : null}
    {canContribute && !ownSummary ? <button className="day-summary-prompt" type="button" onClick={() => dialogRef.current?.showModal()}>Summarize Your Day</button> : null}
    {canContribute ? <dialog className="summary-dialog" ref={dialogRef}><div className="summary-dialog-head"><div><span className="section-kicker">{new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span><h2>Summarize Your Day</h2><p>{userName || "Traveler"}</p></div><button className="icon-button" type="button" aria-label="Close" onClick={() => dialogRef.current?.close()}><X size={20} /></button></div><form onSubmit={save}>
      <textarea aria-label="Day summary" autoFocus maxLength={2000} rows={7} placeholder="What made today memorable?" value={body} onChange={(event) => setBody(event.target.value)} />
      {message && !message.includes("saved") && !message.includes("removed") ? <p className="error" role="alert">{message}</p> : null}
      <div className="day-summary-actions"><button type="submit" aria-label={ownSummary ? "Save summary changes" : "Save summary"} title={ownSummary ? "Save changes" : "Save summary"} disabled={busy || !body.trim()}>{busy ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}</button>{ownSummary ? <button className="day-summary-remove" type="button" aria-label="Delete day summary" title="Delete summary" disabled={busy} onClick={() => void remove()}><Trash2 size={17} /></button> : null}</div>
    </form></dialog> : null}
  </section>;
}
