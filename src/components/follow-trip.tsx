"use client";

import { Bell, BellOff, Check, LoaderCircle, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Props = {
  tripId: string;
  slug: string;
  signedIn: boolean;
  initialFollowing: boolean;
  initialNotifications: boolean;
  vapidPublicKey?: string;
};

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

function notificationErrorMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object" && "message" in value && typeof value.message === "string") return value.message;
  return String(value || "Unknown notification error");
}

export function FollowTrip({ tripId, slug, signedIn, initialFollowing, initialNotifications, vapidPublicKey }: Props) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [following, setFollowing] = useState(initialFollowing);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function openPrompt() { setError(""); dialogRef.current?.showModal(); }
  function closePrompt() { if (!busy) dialogRef.current?.close(); }

  async function follow() {
    if (!signedIn) { router.push(`/login?returnTo=${encodeURIComponent(`/trip/${slug}`)}`); return; }
    setBusy(true); setError("");
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { setBusy(false); router.push(`/login?returnTo=${encodeURIComponent(`/trip/${slug}`)}`); return; }
    const { error: followError } = await supabase.from("trip_follows").upsert({ trip_id: tripId, user_id: user.id, notifications_enabled: false }, { onConflict: "trip_id,user_id" });
    setBusy(false);
    if (followError) { setError(followError.message); return; }
    setFollowing(true); setNotifications(false); openPrompt();
  }

  async function unfollow() {
    setBusy(true); setError("");
    const { error: unfollowError } = await supabase.from("trip_follows").delete().eq("trip_id", tripId);
    setBusy(false);
    if (unfollowError) { setError(unfollowError.message); return; }
    setFollowing(false); setNotifications(false);
  }

  async function enableNotifications() {
    if (!vapidPublicKey) { setError("Notifications are not configured on this deployment yet."); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setError("Push notifications are not supported here. On iPhone, add Roamline to your Home Screen first."); return; }
    setBusy(true); setError("");
    let stage = "requesting notification permission";
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notifications were not allowed. You can enable them later with the bell button.");
      stage = "starting the notification service";
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      stage = "creating the phone subscription";
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(vapidPublicKey) });
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("The notification subscription was incomplete.");
      stage = "saving the phone subscription";
      const { error: subscriptionError } = await supabase.rpc("save_push_subscription", { subscription_trip_id: tripId, subscription_endpoint: json.endpoint, subscription_p256dh: json.keys.p256dh, subscription_auth: json.keys.auth, subscription_user_agent: navigator.userAgent });
      if (subscriptionError) throw subscriptionError;
      stage = "enabling notifications for this trip";
      const { error: followError } = await supabase.from("trip_follows").update({ notifications_enabled: true, updated_at: new Date().toISOString() }).eq("trip_id", tripId);
      if (followError) throw followError;
      setNotifications(true); dialogRef.current?.close();
    } catch (nextError) {
      const detail = notificationErrorMessage(nextError);
      console.error("[notifications] enable failed", { stage, detail });
      setError(`Could not finish ${stage}: ${detail}`);
    }
    finally { setBusy(false); }
  }

  async function disableNotifications() {
    setBusy(true); setError("");
    const { error: updateError } = await supabase.from("trip_follows").update({ notifications_enabled: false, updated_at: new Date().toISOString() }).eq("trip_id", tripId);
    setBusy(false);
    if (updateError) { setError(updateError.message); return; }
    setNotifications(false);
  }

  return <div className="follow-trip-wrap">
    <div className="follow-trip-actions">
      <button className={`follow-trip-button${following ? " is-following" : ""}`} type="button" disabled={busy} onClick={() => void (following ? unfollow() : follow())}>{busy ? <LoaderCircle className="spin" size={15} /> : following ? <Check size={15} /> : <UserPlus size={15} />}{following ? "Following" : "Follow"}</button>
      {following ? <button className={`follow-notification-button${notifications ? " is-on" : ""}`} type="button" disabled={busy} aria-label={notifications ? "Turn off trip notifications" : "Turn on trip notifications"} title={notifications ? "Notifications on" : "Notifications off"} onClick={() => void (notifications ? disableNotifications() : enableNotifications())}>{notifications ? <Bell size={15} /> : <BellOff size={15} />}</button> : null}
    </div>
    {error ? <p className="follow-error" role="alert">{error}</p> : null}
    <dialog className="notification-prompt" ref={dialogRef} onCancel={(event) => { event.preventDefault(); closePrompt(); }}>
      <button className="confirm-close" type="button" aria-label="Close notification prompt" disabled={busy} onClick={closePrompt}><X size={17} /></button>
      <span className="notification-prompt-icon"><Bell size={22} /></span><span className="section-kicker">TRIP UPDATES</span><h2>Get notified when this trip updates?</h2><p>Roamline can let you know when a new check-in, photo, or video is added. You can turn this off anytime.</p>
      {error ? <p className="form-message error" role="alert">{error}</p> : null}
      <div className="notification-prompt-actions"><button className="secondary-button" type="button" disabled={busy} onClick={closePrompt}>Not now</button><button className="primary-button" type="button" disabled={busy} onClick={() => void enableNotifications()}>{busy ? <LoaderCircle className="spin" size={16} /> : <Bell size={16} />} Turn on notifications</button></div>
    </dialog>
  </div>;
}
