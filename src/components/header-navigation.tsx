"use client";

import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";

export function HeaderNavigation({ signedIn, displayName, searchable = false }: { signedIn: boolean; displayName?: string | null; searchable?: boolean }) {
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  const search = (value: string) => window.dispatchEvent(new CustomEvent("roamline-trip-search", { detail: value }));
  return <>
    {searchable ? <div className={`header-search${searching ? " is-open" : ""}`}>{searching ? <input autoFocus type="text" inputMode="search" aria-label="Search trips by name" placeholder="Search trips" onChange={(event) => search(event.target.value)} /> : null}<button type="button" aria-label={searching ? "Close trip search" : "Search trips"} onClick={() => { if (searching) search(""); setSearching((value) => !value); }}>{searching ? <X size={18} /> : <Search size={18} />}</button></div> : null}
    <div className="header-menu" ref={menuRef}><button className="header-icon-button" type="button" aria-label="Open account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><Menu size={19} /></button>{menuOpen ? <div className="header-menu-popover">{signedIn ? <><span>{displayName || "Your account"}</span><Link href="/?scope=mine">Your trips</Link><Link href="/">All trips</Link><form action={signOut}><button type="submit">Sign out</button></form></> : <><span>Explore Roamline</span><Link href="/">All trips</Link><Link href="/login">Sign in</Link><Link href="/login?mode=signup">Create account</Link></>}</div> : null}</div>
  </>;
}
