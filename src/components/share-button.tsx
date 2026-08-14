"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

export function ShareButton({ title, menuItem = false }: { title: string; menuItem?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function share() {
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

  return <button className={menuItem ? "header-menu-action" : "primary-button"} onClick={share} type="button">{copied ? <Check size={16} /> : <Share2 size={16} />}{copied ? "Copied" : "Share"}</button>;
}
