"use client";

import { parse } from "exifr";
import { Check, ImagePlus, LoaderCircle, MapPin, Paperclip, Plus, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";

import { notifyTripFollowers, refreshTrip } from "@/app/trip/[slug]/actions";
import { PlaceSearch, SelectedPlace } from "@/components/place-search";
import { createClient } from "@/lib/supabase/client";
import { loadGeocoding } from "@/lib/google-maps";
import { prepareMedia } from "@/lib/media-derivatives";

type Props = { tripId: string; slug: string };
type UploadItem = {
  id: string;
  file: File;
  status: "extracting" | "ready" | "uploading" | "complete" | "failed";
  progress: number;
  caption: string;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  placeName: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  error?: string;
};

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "video/mp4", "video/quicktime"]);
const ACCEPTED_EXTENSIONS = /\.(?:jpe?g|png|webp|hei[cf]|mp4|mov)$/i;
const SHORTCUT_INSTALL_URL = process.env.NEXT_PUBLIC_ROAMLINE_SHORTCUT_URL ?? "https://www.icloud.com/shortcuts/43fbfc01c53f4b4bb229c5608a9c69ac";

function ApplePhotosMark({ size = 28 }: { size?: number }) {
  const colors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#007aff", "#5856d6", "#af52de"];
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 28 28">{colors.map((color, index) => <ellipse key={color} cx="14" cy="6.4" rx="4.1" ry="6.1" fill={color} fillOpacity=".9" transform={`rotate(${index * 45} 14 14)`} />)}<circle cx="14" cy="14" r="2.2" fill="white" /></svg>;
}
const isAcceptedFile = (file: File) => ACCEPTED_TYPES.has(file.type) || (!file.type && ACCEPTED_EXTENSIONS.test(file.name));

function localDateTime(value?: Date | string | number | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function dimensions(file: File) {
  return new Promise<{ width: number | null; height: number | null; duration: number | null }>((resolve) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve({ width: video.videoWidth || null, height: video.videoHeight || null, duration: Number.isFinite(video.duration) ? video.duration : null }); };
      video.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null, duration: null }); };
      video.src = url;
    } else {
      const image = new window.Image();
      image.onload = () => { URL.revokeObjectURL(url); resolve({ width: image.naturalWidth || null, height: image.naturalHeight || null, duration: null }); };
      image.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null, duration: null }); };
      image.src = url;
    }
  });
}

async function cityCountry(latitude: number, longitude: number) {
  try {
    const { Geocoder } = await loadGeocoding();
    const response = await new Geocoder().geocode({ location: { lat: latitude, lng: longitude } });
    const components = response.results[0]?.address_components ?? [];
    const find = (...types: string[]) => components.find((component) => types.some((type) => component.types.includes(type)))?.long_name;
    const city = find("locality", "postal_town", "administrative_area_level_2", "administrative_area_level_1");
    const country = find("country");
    return [city, country].filter(Boolean).join(", ");
  } catch { return ""; }
}

export function AddMoment({ tripId, slug }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shortcutDialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkinInputRef = useRef<HTMLInputElement>(null);
  const shortcutInstallPendingRef = useRef(false);
  const shortcutSyncingRef = useRef(false);
  const [mode, setMode] = useState<"upload" | "checkin">("upload");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [publishingIds, setPublishingIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [checkinFiles, setCheckinFiles] = useState<File[]>([]);
  const [selectedPlace, setSelectedPlace] = useState({ id: "", name: "", address: "", latitude: "", longitude: "" });
  const [isAppleMobile, setIsAppleMobile] = useState(false);
  const [shortcutReady, setShortcutReady] = useState(false);
  const [launchingShortcut, setLaunchingShortcut] = useState(false);
  const [shortcutSyncStatus, setShortcutSyncStatus] = useState<"idle" | "syncing" | "complete">("idle");
  const selectPlace = useCallback((place: SelectedPlace) => setSelectedPlace({ ...place, latitude: String(place.latitude), longitude: String(place.longitude) }), []);

  useEffect(() => {
    const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsAppleMobile(appleMobile);
    setShortcutReady(window.localStorage.getItem("roamline-iphone-shortcut-ready") === "true");
  }, []);

  useEffect(() => {
    const continueAfterInstall = () => {
      if (document.visibilityState !== "visible" || !shortcutInstallPendingRef.current) return;
      shortcutInstallPendingRef.current = false;
      shortcutDialogRef.current?.close();
      void launchIphoneUpload();
    };
    document.addEventListener("visibilitychange", continueAfterInstall);
    return () => document.removeEventListener("visibilitychange", continueAfterInstall);
  });

  useEffect(() => {
    async function syncReturnedUpload() {
      if (document.visibilityState !== "visible" || shortcutSyncingRef.current) return;
      const stored = window.sessionStorage.getItem("roamline-iphone-upload-pending");
      if (!stored) return;
      let pending: { sessionId?: string; tripId?: string };
      try { pending = JSON.parse(stored); } catch { window.sessionStorage.removeItem("roamline-iphone-upload-pending"); return; }
      if (!pending.sessionId || pending.tripId !== tripId) return;
      shortcutSyncingRef.current = true;
      setShortcutSyncStatus("syncing");
      try {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const response = await fetch(`/api/iphone-upload/session?id=${encodeURIComponent(pending.sessionId)}`, { cache: "no-store" });
          const status = await response.json();
          if (!response.ok || status.complete || status.expired) break;
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
        await showLatestTrip();
        window.sessionStorage.removeItem("roamline-iphone-upload-pending");
        dialogRef.current?.close();
        setShortcutSyncStatus("complete");
        window.setTimeout(() => setShortcutSyncStatus("idle"), 2600);
      } finally {
        shortcutSyncingRef.current = false;
      }
    }
    const onVisible = () => { void syncReturnedUpload(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    void syncReturnedUpload();
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("pageshow", onVisible); };
  });

  async function launchIphoneUpload() {
    setLaunchingShortcut(true); setMessage("");
    try {
      const response = await fetch("/api/iphone-upload/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const result = await response.json();
      if (!response.ok || !result.launchUrl || !result.sessionId) throw new Error(result.error ?? "Could not open the iPhone uploader.");
      window.sessionStorage.setItem("roamline-iphone-upload-pending", JSON.stringify({ sessionId: result.sessionId, tripId, startedAt: Date.now() }));
      dialogRef.current?.close();
      window.location.assign(result.launchUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open the iPhone uploader.");
    } finally {
      setLaunchingShortcut(false);
    }
  }

  function chooseUploadSource() {
    if (!isAppleMobile) { inputRef.current?.click(); return; }
    if (shortcutReady) { void launchIphoneUpload(); return; }
    shortcutDialogRef.current?.showModal();
  }

  async function showLatestTrip() {
    await refreshTrip(slug);
    router.refresh();
  }

  async function addFiles(files: FileList | File[]) {
    const accepted = [...files].filter(isAcceptedFile);
    if (accepted.length !== files.length) setMessage("Some files were skipped because their format is not supported.");
    const initial = accepted.map((file) => ({ id: crypto.randomUUID(), file, status: "extracting" as const, progress: 0, caption: "", capturedAt: localDateTime(file.lastModified), latitude: null, longitude: null, placeName: "", width: null, height: null, duration: null }));
    setItems((current) => [...current, ...initial]);
    for (const item of initial) {
      if (item.file.size > MAX_FILE_SIZE) {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: "File is larger than 500 MB." } : entry));
        continue;
      }
      try {
        const [metadata, size] = await Promise.all([
          item.file.type.startsWith("image/") ? parse(item.file, { gps: true, tiff: true, exif: true }) : Promise.resolve(null),
          dimensions(item.file),
        ]);
        const latitude = typeof metadata?.latitude === "number" ? metadata.latitude : null;
        const longitude = typeof metadata?.longitude === "number" ? metadata.longitude : null;
        const inferredPlace = latitude !== null && longitude !== null ? await cityCountry(latitude, longitude) : "";
        setItems((current) => current.map((entry) => entry.id === item.id ? {
          ...entry,
          status: "ready",
          capturedAt: localDateTime(metadata?.DateTimeOriginal ?? metadata?.CreateDate ?? item.file.lastModified),
          latitude,
          longitude,
          placeName: inferredPlace,
          ...size,
        } : entry));
      } catch {
        const size = await dimensions(item.file);
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "ready", ...size } : entry));
      }
    }
  }

  async function resumableUpload(file: File, path: string, itemId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Your session expired. Please sign in again.");
    const projectId = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
        headers: { authorization: `Bearer ${session.access_token}` },
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: { bucketName: "trip-media", objectName: path, contentType: file.type, cacheControl: "31536000" },
        onProgress: (sent, total) => setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, progress: Math.round((sent / total) * 100) } : entry)),
        onError: reject,
        onSuccess: () => resolve(),
      });
      upload.findPreviousUploads().then((previous) => { if (previous[0]) upload.resumeFromPreviousUpload(previous[0]); upload.start(); }).catch(reject);
    });
  }

  async function publishUploads() {
    const queue = items.filter((item) => item.status === "ready" || item.status === "failed");
    if (!queue.length) return;
    setPublishingIds(queue.map((item) => item.id)); setBusy(true); setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setPublishingIds([]); setMessage("Your session expired. Please sign in again."); return; }
    let completed = 0;
    for (const item of queue) {
      const resolvedPlace = item.placeName.trim() || (item.latitude !== null && item.longitude !== null ? await cityCountry(item.latitude, item.longitude) : "");
      const mediaId = crypto.randomUUID();
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "uploading", progress: 0, error: undefined } : entry));
      try {
        const prepared = await prepareMedia(item.file);
        const extension = prepared.primary.name.includes(".") ? prepared.primary.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
        const path = `${tripId}/${user.id}/${mediaId}.${extension}`;
        const thumbnailPath = prepared.thumbnail ? `${tripId}/${user.id}/${mediaId}-thumb.webp` : null;
        if (prepared.primary.size >= RESUMABLE_THRESHOLD) await resumableUpload(prepared.primary, path, item.id);
        else {
          const { error } = await supabase.storage.from("trip-media").upload(path, prepared.primary, { contentType: prepared.primary.type, cacheControl: "31536000", upsert: false });
          if (error) throw error;
        }
        if (prepared.thumbnail && thumbnailPath) {
          const { error } = await supabase.storage.from("trip-media").upload(thumbnailPath, prepared.thumbnail, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
          if (error) { await supabase.storage.from("trip-media").remove([path]); throw error; }
        }
        const { error } = await supabase.from("media").insert({ trip_id: tripId, uploader_id: user.id, kind: item.file.type.startsWith("video/") ? "video" : "photo", storage_path: path, thumbnail_storage_path: thumbnailPath, original_filename: item.file.name, mime_type: prepared.primary.type, width: prepared.width, height: prepared.height, duration_seconds: prepared.duration, caption: item.caption.trim() || null, captured_at: item.capturedAt ? new Date(item.capturedAt).toISOString() : null, place_name: resolvedPlace || null, latitude: item.latitude, longitude: item.longitude, metadata: { source: "browser-upload", originalLastModified: item.file.lastModified, originalBytes: item.file.size, displayBytes: prepared.primary.size, thumbnailBytes: prepared.thumbnail?.size ?? null } });
        if (error) { await supabase.storage.from("trip-media").remove([path, ...(thumbnailPath ? [thumbnailPath] : [])]); throw error; }
        completed += 1;
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "complete", progress: 100 } : entry));
      } catch (error) {
        setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "failed", error: error instanceof Error ? error.message : "Upload failed." } : entry));
      }
    }
    setBusy(false); setPublishingIds([]);
    if (completed) {
      await notifyTripFollowers(tripId, "media", completed);
      await showLatestTrip();
      if (completed === queue.length) { setItems([]); dialogRef.current?.close(); }
      else setMessage(`${completed} of ${queue.length} moments published. Retry the files that failed.`);
    }
  }

  const publishingItems = publishingIds.map((id) => items.find((item) => item.id === id)).filter((item): item is UploadItem => Boolean(item));
  const publishingComplete = publishingItems.filter((item) => item.status === "complete").length;
  const publishingFailed = publishingItems.filter((item) => item.status === "failed").length;
  const publishingProgress = publishingItems.length ? Math.round(publishingItems.reduce((total, item) => total + (item.status === "complete" ? 100 : item.progress), 0) / publishingItems.length) : 0;
  const publishingCurrent = publishingItems.find((item) => item.status === "uploading");

  async function createCheckin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setMessage("Your session expired. Please sign in again."); return; }
    const occurredAt = new Date(String(form.get("occurredAt"))).toISOString();
    const { data: checkin, error } = await supabase.from("checkins").insert({ trip_id: tripId, author_id: user.id, place_id: String(form.get("placeId") || "").trim() || null, place_name: String(form.get("placeName") || "").trim(), formatted_address: String(form.get("address") || "").trim() || null, latitude: Number(form.get("latitude")), longitude: Number(form.get("longitude")), occurred_at: occurredAt, note: String(form.get("note") || "").trim() || null }).select("id").single();
    if (error || !checkin) { setBusy(false); setMessage(error?.message ?? "The check-in could not be created."); return; }
    for (const file of checkinFiles) {
      try {
        const prepared = await prepareMedia(file);
        const mediaId = crypto.randomUUID();
        const extension = prepared.primary.name.includes(".") ? prepared.primary.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "bin";
        const path = `${tripId}/${user.id}/${mediaId}.${extension}`;
        const thumbnailPath = prepared.thumbnail ? `${tripId}/${user.id}/${mediaId}-thumb.webp` : null;
        if (prepared.primary.size >= RESUMABLE_THRESHOLD) await resumableUpload(prepared.primary, path, "checkin-attachment");
        else { const result = await supabase.storage.from("trip-media").upload(path, prepared.primary, { contentType: prepared.primary.type, cacheControl: "31536000", upsert: false }); if (result.error) throw result.error; }
        if (prepared.thumbnail && thumbnailPath) { const result = await supabase.storage.from("trip-media").upload(thumbnailPath, prepared.thumbnail, { contentType: "image/webp", cacheControl: "31536000", upsert: false }); if (result.error) { await supabase.storage.from("trip-media").remove([path]); throw result.error; } }
        const result = await supabase.from("media").insert({ trip_id: tripId, checkin_id: checkin.id, uploader_id: user.id, kind: file.type.startsWith("video/") ? "video" : "photo", storage_path: path, thumbnail_storage_path: thumbnailPath, original_filename: file.name, mime_type: prepared.primary.type, width: prepared.width, height: prepared.height, duration_seconds: prepared.duration, captured_at: occurredAt, place_name: selectedPlace.name.trim() || null, latitude: Number(selectedPlace.latitude), longitude: Number(selectedPlace.longitude), metadata: { source: "checkin-attachment", originalLastModified: file.lastModified, originalBytes: file.size, displayBytes: prepared.primary.size, thumbnailBytes: prepared.thumbnail?.size ?? null } });
        if (result.error) { await supabase.storage.from("trip-media").remove([path, ...(thumbnailPath ? [thumbnailPath] : [])]); throw result.error; }
      } catch { /* Keep the check-in even if one attachment fails. */ }
    }
    await notifyTripFollowers(tripId, "checkin");
    setBusy(false); setCheckinFiles([]); setSelectedPlace({ id: "", name: "", address: "", latitude: "", longitude: "" }); formElement.reset(); await showLatestTrip(); dialogRef.current?.close();
  }

  return <>
    {shortcutSyncStatus !== "idle" ? <div className={`shortcut-return-status ${shortcutSyncStatus}`} role="status">{shortcutSyncStatus === "syncing" ? <><LoaderCircle className="spin" size={16} /> Updating journey…</> : <><Check size={16} /> Journey updated</>}</div> : null}
    <button className="floating-add" type="button" onClick={() => dialogRef.current?.showModal()}><Plus size={17} /> Add moment</button>
    <dialog className="moment-dialog" ref={dialogRef} onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={() => setMessage("")}>
      <div className="dialog-head"><div><span className="section-kicker">{slug}</span><h2>{publishingIds.length ? "Publishing moments" : "Add to the journey"}</h2></div><button className="icon-button" type="button" aria-label="Close" disabled={busy} onClick={() => dialogRef.current?.close()}><X size={19} /></button></div>
      {!publishingIds.length ? <div className="moment-tabs" role="tablist"><button type="button" role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")}><ImagePlus size={16} /> Photos & videos</button><button type="button" role="tab" aria-selected={mode === "checkin"} onClick={() => setMode("checkin")}><MapPin size={16} /> Check in</button></div> : null}
      {mode === "upload" ? <div>
        {publishingIds.length ? <section className="upload-progress-panel" aria-live="polite">
          <div className="upload-progress-icon"><Upload size={22} /></div>
          <span className="section-kicker">UPLOADING YOUR JOURNEY</span>
          <div className="upload-progress-heading"><strong>{publishingComplete} of {publishingIds.length} complete</strong><span>{publishingProgress}%</span></div>
          <progress max="100" value={publishingProgress} aria-label={`Upload progress: ${publishingProgress}%`} />
          <p>{publishingCurrent ? `Uploading ${publishingCurrent.file.name}` : "Preparing the next file…"}</p>
          {publishingFailed ? <small>{publishingFailed} {publishingFailed === 1 ? "file has" : "files have"} failed. You can retry after the remaining uploads finish.</small> : null}
          <span className="upload-stay-open">Keep Roamline open until publishing is complete.</span>
        </section> : <>
          <button className="drop-zone" type="button" disabled={launchingShortcut} onClick={chooseUploadSource} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(event.dataTransfer.files); }}>{isAppleMobile ? <ApplePhotosMark /> : <Upload size={22} />}<strong>{launchingShortcut ? "Opening Apple Photos…" : isAppleMobile ? "Upload with Apple Photos" : "Choose photos or videos"}</strong><span>{isAppleMobile ? "Select many at once, then return here when publishing finishes" : "Multi-select or drag and drop · JPG, HEIC, PNG, WebP, MP4, MOV · up to 500 MB each"}</span></button>
          <input ref={inputRef} hidden type="file" accept="image/*,video/*,.heic,.heif" multiple onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }} />
          <div className="upload-list">{items.map((item) => <article className="upload-item" key={item.id}><div className="upload-status">{item.status === "complete" ? <Check size={17} /> : item.status === "extracting" || item.status === "uploading" ? <LoaderCircle className="spin" size={17} /> : <ImagePlus size={17} />}</div><div><strong>{item.file.name}</strong><span>{(item.file.size / 1024 / 1024).toFixed(1)} MB · {item.latitude === null ? "No GPS metadata" : "GPS found"} · {item.status}{item.status === "uploading" ? ` ${item.progress}%` : ""}</span><div className="upload-fields"><input aria-label={`Caption for ${item.file.name}`} placeholder="Caption (optional)" value={item.caption} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, caption: event.target.value } : entry))} /><input aria-label={`Capture time for ${item.file.name}`} type="datetime-local" value={item.capturedAt} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, capturedAt: event.target.value } : entry))} /></div><div className="upload-location-editor"><PlaceSearch key={`${item.id}-${item.placeName}`} compact showCurrentLocation={false} initialQuery={item.placeName} placeholder="Search for the place…" onSelect={(place) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, placeName: place.name, latitude: place.latitude, longitude: place.longitude } : entry))} /><div className="upload-coordinates"><input aria-label={`Latitude for ${item.file.name}`} type="number" min="-90" max="90" step="any" placeholder="Latitude" value={item.latitude ?? ""} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, latitude: event.target.value === "" ? null : Number(event.target.value), placeName: "" } : entry))} /><input aria-label={`Longitude for ${item.file.name}`} type="number" min="-180" max="180" step="any" placeholder="Longitude" value={item.longitude ?? ""} onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, longitude: event.target.value === "" ? null : Number(event.target.value), placeName: "" } : entry))} /></div>{item.placeName ? <small className="resolved-place"><MapPin size={12} /> {item.placeName}</small> : item.latitude !== null && item.longitude !== null ? <small className="resolved-place">City and country will be resolved from these coordinates.</small> : null}</div>{item.error ? <span className="item-error">{item.error}</span> : null}</div><button className="icon-button" type="button" aria-label={`Remove ${item.file.name}`} disabled={busy} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><X size={16} /></button></article>)}</div>
          {items.length ? <button className="primary-button publish-button" type="button" disabled={busy || items.every((item) => item.status === "complete" || item.status === "extracting")} onClick={() => void publishUploads()}>Publish ready files</button> : null}
        </>}
      </div> : <form className="checkin-form" onSubmit={createCheckin}>
        <label><span>Find a place</span><PlaceSearch onSelect={selectPlace} /></label>
        <input type="hidden" name="placeId" value={selectedPlace.id} />
        <label><span>Place name</span><input name="placeName" required maxLength={180} placeholder="Eorzea Cafe" value={selectedPlace.name} onChange={(event) => setSelectedPlace((current) => ({ ...current, id: "", name: event.target.value }))} /></label>
        <label><span>Address</span><input name="address" placeholder="Akihabara, Tokyo" value={selectedPlace.address} onChange={(event) => setSelectedPlace((current) => ({ ...current, id: "", address: event.target.value }))} /></label>
        <div className="coordinate-grid"><label><span>Latitude</span><input name="latitude" required type="number" min="-90" max="90" step="any" placeholder="35.6984" value={selectedPlace.latitude} onChange={(event) => setSelectedPlace((current) => ({ ...current, id: "", latitude: event.target.value }))} /></label><label><span>Longitude</span><input name="longitude" required type="number" min="-180" max="180" step="any" placeholder="139.7731" value={selectedPlace.longitude} onChange={(event) => setSelectedPlace((current) => ({ ...current, id: "", longitude: event.target.value }))} /></label></div>
        <label><span>Date and time</span><input name="occurredAt" required type="datetime-local" defaultValue={localDateTime()} /></label>
        <label><span>Note (optional)</span><textarea name="note" maxLength={1200} placeholder="What happened here?" /></label>
        <div className="checkin-attachments"><button className="location-button" type="button" onClick={() => checkinInputRef.current?.click()}><Paperclip size={15} /> Add photos or videos</button><input ref={checkinInputRef} hidden type="file" accept="image/*,video/*,.heic,.heif" multiple onChange={(event) => { if (event.target.files) setCheckinFiles((current) => [...current, ...[...event.target.files!].filter((file) => isAcceptedFile(file) && file.size <= MAX_FILE_SIZE)]); event.target.value = ""; }} />{checkinFiles.length ? <div className="attachment-list">{checkinFiles.map((file, index) => <span key={`${file.name}-${index}`}>{file.name}<button type="button" aria-label={`Remove ${file.name}`} onClick={() => setCheckinFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={13} /></button></span>)}</div> : <p className="place-help">Optional · select multiple photos or videos</p>}</div>
        <button className="primary-button publish-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <MapPin size={16} />} Add check-in</button>
      </form>}
      {message ? <p className={`dialog-message ${message === "Check-in added." || message.includes("published") ? "success" : ""}`} role="status">{message}</p> : null}
    </dialog>
    <dialog className="shortcut-setup-dialog" ref={shortcutDialogRef} onCancel={(event) => event.preventDefault()}>
      <div className="dialog-head"><h2>Add Roamline Shortcut</h2></div>
      <div className="shortcut-setup-body">
        <div className="shortcut-setup-mark"><ApplePhotosMark size={30} /></div>
        <p>This is required to upload photos on an Apple device.</p>
        <a className="primary-button shortcut-install" href={SHORTCUT_INSTALL_URL} target="_blank" rel="noreferrer" onClick={() => { window.localStorage.setItem("roamline-iphone-shortcut-ready", "true"); setShortcutReady(true); shortcutInstallPendingRef.current = true; }}>Add Shortcut</a>
      </div>
    </dialog>
  </>;
}
