"use client";

import { Check } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

import { useMediaSelection } from "@/components/media-selection";

export type SelectableMediaItem = { id: string; storagePath: string; url: string; caption: string | null; kind: "photo" | "video"; reactions: string[]; canManage: boolean };

export function SelectableMediaGrid({ items, onOpen }: { items: SelectableMediaItem[]; onOpen: (index: number) => void }) {
  const { selected, selecting, toggle } = useMediaSelection();
  const timerRef = useRef<number | null>(null);
  const longPressedRef = useRef(false);
  function beginPress(item: SelectableMediaItem) {
    if (!item.canManage) return;
    longPressedRef.current = false;
    timerRef.current = window.setTimeout(() => { longPressedRef.current = true; toggle(item); if (navigator.vibrate) navigator.vibrate(25); }, 520);
  }
  function endPress() { if (timerRef.current !== null) window.clearTimeout(timerRef.current); timerRef.current = null; }
  function activate(item: SelectableMediaItem, index: number) {
    if (longPressedRef.current) { longPressedRef.current = false; return; }
    if (selecting && item.canManage) toggle(item); else onOpen(index);
  }
  return <div className={`moment-grid real-moments${selecting ? " is-selecting" : ""}`}>{items.map((item, index) => <div className={`moment media-open${selected.has(item.id) ? " is-selected" : ""}`} key={item.id}>
    {item.kind === "photo" ? <Image src={item.url} alt={item.caption || "Trip photo"} fill sizes="(max-width: 800px) 50vw, 33vw" /> : <video src={item.url} muted preload="metadata" />}{item.caption ? <span className="media-caption">{item.caption}</span> : null}
    {item.reactions.length ? <div className="timeline-reactions" aria-label={`${item.reactions.length} ${item.reactions.length === 1 ? "reaction" : "reactions"}`}>{[...new Set(item.reactions)].slice(0, 3).map((emoji) => <span key={emoji}>{emoji}</span>)}<strong>{item.reactions.length}</strong></div> : null}
    <button className="media-hit" type="button" aria-label={`${selected.has(item.id) ? "Deselect" : selecting ? "Select" : "Open"} ${item.caption || (item.kind === "photo" ? "photo" : "video")}`} onPointerDown={() => beginPress(item)} onPointerUp={endPress} onPointerCancel={endPress} onPointerLeave={endPress} onClick={() => activate(item, index)} />
    {item.canManage ? <button className="media-select-indicator" type="button" aria-label={selected.has(item.id) ? "Deselect moment" : "Select moment"} onClick={() => toggle(item)}>{selected.has(item.id) ? <Check size={15} strokeWidth={3} /> : null}</button> : null}
  </div>)}</div>;
}
