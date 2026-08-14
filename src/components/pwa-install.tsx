"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
      if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("roamline-")).map((key) => caches.delete(key))));
      return;
    }
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone || localStorage.getItem("roamline-install-dismissed") === "1") return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const iosTimer = isIos ? window.setTimeout(() => { setIos(true); setVisible(true); }, 1200) : null;
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); setVisible(true); };
    window.addEventListener("beforeinstallprompt", capture); return () => { window.removeEventListener("beforeinstallprompt", capture); if (iosTimer) window.clearTimeout(iosTimer); };
  }, []);
  function dismiss() { localStorage.setItem("roamline-install-dismissed", "1"); setVisible(false); }
  async function install() { if (!prompt) return; await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === "accepted") setVisible(false); setPrompt(null); }
  if (!visible) return null;
  return <aside className="install-prompt" aria-label="Install Roamline"><button className="install-close" type="button" aria-label="Dismiss install prompt" onClick={dismiss}><X size={16} /></button><span className="install-mark"><Download size={19} /></span><div><strong>Add Roamline to your phone</strong>{ios ? <p>In Safari, tap <Share size={13} /> Share, then <b>Add to Home Screen</b>.</p> : <p>Open trips like an app and keep Roamline one tap away.</p>}</div>{prompt ? <button className="install-action" type="button" onClick={() => void install()}>Install</button> : null}</aside>;
}
