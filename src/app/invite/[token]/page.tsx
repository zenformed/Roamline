import Link from "next/link";
import { CalendarClock, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";

import { acceptInvitation } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function InvitationPage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  const supabase = await createClient();
  const [{ data: invitations }, { data: userData }] = await Promise.all([supabase.rpc("get_trip_invitation", { p_token: token }), supabase.auth.getUser()]);
  const invitation = invitations?.[0];
  if (!invitation) notFound();
  return <main className="invite-page"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>Roamline</Link><section className="invite-card"><div className="state-mark"><UserPlus size={22} /></div><span className="section-kicker">TRIP INVITATION</span><h1>Join {invitation.trip_name}</h1><p>You’ve been invited as a contributor. You’ll be able to add photos, videos, and check-ins alongside the family.</p><p className="invite-expiry"><CalendarClock size={14} /> Expires {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(invitation.expires_at))}</p>{userData.user ? <form action={acceptInvitation}><input type="hidden" name="token" value={token} /><button className="primary-button" type="submit">Accept invitation</button></form> : <Link className="primary-button" href={`/login?mode=signup&returnTo=${encodeURIComponent(`/invite/${token}`)}`}>Sign in or create an account</Link>}</section></main>;
}
