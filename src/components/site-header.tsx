import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderNavigation } from "@/components/header-navigation";

export async function SiteHeader({ searchable = false }: { searchable?: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  let displayName: string | null = null;

  if (claims?.sub) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", claims.sub)
      .maybeSingle();
    displayName = profile?.display_name ?? null;
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Roamline home">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        Roamline
      </Link>
      <nav className="header-actions" aria-label="Primary navigation">
        <ThemeToggle />
        <HeaderNavigation signedIn={Boolean(claims)} displayName={displayName ?? claims?.email ?? null} searchable={searchable} />
      </nav>
    </header>
  );
}
