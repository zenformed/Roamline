"use client";

import Link from "next/link";
import { Menu, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";
import { InvitePeople } from "@/components/invite-people";
import { ShareButton } from "@/components/share-button";

type Collaborator = { id: string; displayName: string };
type Invitation = { id: string; token: string; expiresAt: string };
type Props = { signedIn: boolean; displayName?: string | null; searchable?: boolean; initialSearch?: string; shareTitle?: string; shareTripId?: string; shareVisibility?: string; canEnableLinkSharing?: boolean; inviteTripId?: string; inviteUserId?: string; collaborators?: Collaborator[]; invitations?: Invitation[] };

export function HeaderNavigation({ signedIn, displayName, searchable = false, initialSearch = "", shareTitle, shareTripId, shareVisibility, canEnableLinkSharing, inviteTripId, inviteUserId, collaborators = [], invitations = [] }: Props) {
  const router = useRouter();
  const [searching, setSearching] = useState(Boolean(initialSearch));
  const [query, setQuery] = useState(initialSearch);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); }; document.addEventListener("pointerdown", close); return () => document.removeEventListener("pointerdown", close); }, []);
  useEffect(() => {
    if (!searchable) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const trimmed = query.trim();
      if (trimmed) params.set("q", trimmed); else params.delete("q");
      params.delete("page");
      const next = params.toString();
      router.replace(`${window.location.pathname}${next ? `?${next}` : ""}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, router, searchable]);
  function closeSearch() {
    setQuery("");
    setSearching(false);
    const params = new URLSearchParams(window.location.search);
    params.delete("q");
    params.delete("page");
    const next = params.toString();
    router.replace(`${window.location.pathname}${next ? `?${next}` : ""}`, { scroll: false });
  }
  return <>
    {searchable ? <div className={`header-search${searching ? " is-open" : ""}`}>{searching ? <input autoFocus type="text" inputMode="search" aria-label="Search trips by name" placeholder="Search trips" value={query} onChange={(event) => setQuery(event.target.value)} /> : null}<button type="button" aria-label={searching ? "Close trip search" : "Search trips"} onClick={() => { if (searching) closeSearch(); else setSearching(true); }}>{searching ? <X size={18} /> : <Search size={18} />}</button></div> : null}
    <div className="header-menu" ref={menuRef}><button className="header-icon-button" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><Menu size={19} /></button>{menuOpen ? <div className="header-menu-popover">{signedIn ? <><span>{displayName || "Your account"}</span>{shareTitle ? <ShareButton title={shareTitle} tripId={shareTripId} visibility={shareVisibility} canEnableLinkSharing={canEnableLinkSharing} menuItem /> : null}{inviteTripId && inviteUserId ? <InvitePeople tripId={inviteTripId} userId={inviteUserId} collaborators={collaborators} invitations={invitations} menuItem /> : null}<Link href="/?scope=mine">Your trips</Link><Link href="/">All trips</Link><form action={signOut}><button type="submit">Sign out</button></form></> : <><span>Explore Roamline</span>{shareTitle ? <ShareButton title={shareTitle} tripId={shareTripId} visibility={shareVisibility} canEnableLinkSharing={canEnableLinkSharing} menuItem /> : null}<Link href="/">All trips</Link><Link href="/login">Sign in</Link><Link href="/login?mode=signup">Create account</Link></>}</div> : null}</div>
  </>;
}
