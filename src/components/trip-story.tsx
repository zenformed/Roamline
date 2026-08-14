"use client";

import { ChevronLeft, ChevronRight, Music2, Pause, Play, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type StoryMoment = { id: string; url: string; kind: "photo" | "video"; caption: string | null; placeName: string | null; capturedAt: string | null };
const TRACKS = [
  { title: "Beautiful Dream", artist: "Diego Nava", src: "/music/beautiful-dream.mp3" },
  { title: "Silent Descent", artist: "Eugenio Mininni", src: "/music/silent-descent.mp3" },
  { title: "Serene View", artist: "Arulo", src: "/music/serene-view.mp3" },
  { title: "Discover", artist: "Eugenio Mininni", src: "/music/discover.mp3" },
  { title: "Relaxing in Nature", artist: "Diego Nava", src: "/music/relaxing-in-nature.mp3" },
  { title: "Sun and His Daughter", artist: "Eugenio Mininni", src: "/music/sun-and-his-daughter.mp3" },
  { title: "Valley Sunset", artist: "Alejandro Magaña (A. M.)", src: "/music/valley-sunset.mp3" },
  { title: "Wedding 01", artist: "Francisco Alvear", src: "/music/wedding-01.mp3" },
  { title: "Romantic", artist: "Francisco Alvear", src: "/music/romantic.mp3" },
  { title: "Night Sky Hip Hop", artist: "Michael Ramir C.", src: "/music/night-sky-hip-hop.mp3" },
];

function randomTrack(previous = -1) {
  const choices = TRACKS.map((_, index) => index).filter((index) => index !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

export function TripStory({ title, moments }: { title: string; moments: StoryMoment[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [index, setIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const moment = moments[index];

  function move(direction: -1 | 1) {
    setIndex((current) => (current + direction + moments.length) % moments.length);
  }

  function start() {
    if (!moments.length) return;
    const previous = Number(localStorage.getItem("roamline-story-track") ?? -1);
    const nextTrack = randomTrack(previous);
    localStorage.setItem("roamline-story-track", String(nextTrack));
    setTrackIndex(nextTrack); setIndex(0); setPlaying(true); dialogRef.current?.showModal();
    window.setTimeout(() => void audioRef.current?.play(), 0);
  }

  function close() { setPlaying(false); audioRef.current?.pause(); videoRef.current?.pause(); dialogRef.current?.close(); }
  function togglePlayback() {
    setPlaying((current) => {
      if (current) { audioRef.current?.pause(); videoRef.current?.pause(); }
      else { void audioRef.current?.play(); void videoRef.current?.play(); }
      return !current;
    });
  }
  function changeTrack() {
    const next = randomTrack(trackIndex); setTrackIndex(next); localStorage.setItem("roamline-story-track", String(next));
    window.setTimeout(() => { if (audioRef.current) { audioRef.current.currentTime = 0; void audioRef.current.play(); } }, 0);
  }

  useEffect(() => {
    if (!playing || !moment || moment.kind === "video") return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % moments.length), 5000);
    return () => window.clearTimeout(timer);
  }, [index, moment, moments.length, playing]);

  useEffect(() => {
    if (!audioRef.current || !moment) return;
    audioRef.current.volume = 0.42;
    if (playing) void audioRef.current.play();
  }, [moment, playing, trackIndex]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !moment || moment.kind !== "video") return;
    video.volume = 0.2;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [index, moment, playing]);

  if (!moments.length) return null;
  const progress = ((index + 1) / moments.length) * 100;

  return <>
    <button className="story-launch" type="button" onClick={start} aria-label={`Play ${title} story`}><Play size={18} fill="currentColor" /> Play journey</button>
    <dialog className="trip-story" ref={dialogRef} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => setPlaying(false)}>
      {moment ? <div className="story-shell">
        <div className="story-progress"><span style={{ width: `${progress}%` }} /></div>
        <div className="story-top"><div><strong>{title}</strong><span>{index + 1} of {moments.length}</span></div><button type="button" aria-label="Close story" onClick={close}><X size={22} /></button></div>
        <div className={`story-stage story-enter ${moment.kind === "photo" ? `story-photo story-motion-${index % 4}` : "story-video"}`} key={moment.id}>
          {moment.kind === "photo" ? <Image src={moment.url} alt={moment.caption || moment.placeName || "Trip moment"} fill sizes="100vw" priority /> : <video ref={videoRef} src={moment.url} autoPlay playsInline controls onEnded={() => move(1)} />}
          <div className="story-shade" />
          <div className="story-copy"><time>{moment.capturedAt ? new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(moment.capturedAt)) : "Trip moment"}</time>{moment.caption || moment.placeName ? <h2>{moment.caption || moment.placeName}</h2> : null}{moment.caption && moment.placeName ? <p>{moment.placeName}</p> : null}</div>
        </div>
        <audio ref={audioRef} src={TRACKS[trackIndex].src} loop muted={muted} />
        <div className="story-controls">
          <button type="button" aria-label="Previous moment" onClick={() => move(-1)}><ChevronLeft size={21} /></button>
          <button className="story-play" type="button" aria-label={playing ? "Pause story" : "Play story"} onClick={togglePlayback}>{playing ? <Pause size={21} fill="currentColor" /> : <Play size={21} fill="currentColor" />}</button>
          <button type="button" aria-label="Next moment" onClick={() => move(1)}><ChevronRight size={21} /></button>
          <div className="story-track"><Music2 size={15} /><span><strong>{TRACKS[trackIndex].title}</strong> · {TRACKS[trackIndex].artist}</span></div>
          <button type="button" aria-label="Next song" onClick={changeTrack}><SkipForward size={19} /></button>
          <button type="button" aria-label={muted ? "Unmute music" : "Mute music"} onClick={() => setMuted((current) => !current)}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        </div>
      </div> : null}
    </dialog>
  </>;
}
