"use client";

import { LoaderCircle, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { deleteDaySummary, saveDaySummary } from "@/app/trip/[slug]/actions";

type Summary = { id: string; authorId: string; authorName: string; body: string };
type Props = { tripId: string; slug: string; date: string; summaries: Summary[]; canContribute: boolean; userId: string | null; userName: string | null };

export function DaySummary({ tripId, slug, date, summaries: initialSummaries, canContribute, userId, userName }: Props) {
  const router = useRouter();
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
    setBody(saved.body); setMessage("Day summary saved."); router.refresh();
  }

  async function remove() {
    if (!ownSummary) return;
    setBusy(true); setMessage("");
    const result = await deleteDaySummary(ownSummary.id, slug);
    setBusy(false);
    if (!result.success) { setMessage(result.error ?? "This summary could not be removed."); return; }
    setSummaries((current) => current.filter((summary) => summary.id !== ownSummary.id));
    setBody(""); setMessage("Day summary removed."); router.refresh();
  }

  const visibleSummaries = canContribute && userId ? summaries.filter((summary) => summary.authorId !== userId) : summaries;
  if (!canContribute && !visibleSummaries.length) return null;

  return <section className="day-summary">
    {canContribute ? <form onSubmit={save}>
      <label htmlFor={`day-summary-${date}`}>Summarize Your Day</label>
      <textarea id={`day-summary-${date}`} maxLength={2000} rows={3} placeholder="What made today memorable?" value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="day-summary-actions"><button type="submit" aria-label={ownSummary ? "Save summary changes" : "Save summary"} title={ownSummary ? "Save changes" : "Save summary"} disabled={busy || !body.trim()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}</button>{ownSummary ? <button className="day-summary-remove" type="button" aria-label="Delete day summary" title="Delete summary" disabled={busy} onClick={() => void remove()}><Trash2 size={16} /></button> : null}</div>
      {message ? <p className={message.includes("saved") || message.includes("removed") ? "success" : "error"} role="status">{message}</p> : null}
    </form> : null}
    {visibleSummaries.length ? <div className="day-summary-list">{visibleSummaries.map((summary) => <article key={summary.id}><strong>{summary.authorName}</strong><p>{summary.body}</p></article>)}</div> : null}
  </section>;
}
