"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdFinishing.module.css";

type Props = { soundtrackUrl: string; videoUrl: string | null; originalAudioAvailable: boolean; context?: "finishing" | "showcase"; initialOriginal?: boolean };

/** The WAV is the playback clock. Original video sound is an audition layer only. */
export function SoundtrackPreview({ soundtrackUrl, videoUrl, originalAudioAvailable, context = "finishing", initialOriginal = false }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const playAttempt = useRef(0);
  const [includeOriginal, setIncludeOriginal] = useState(initialOriginal);
  const [volume, setVolume] = useState(0.5);
  const [error, setError] = useState("");
  const showcase = context === "showcase";
  const nativeEnabled = originalAudioAvailable && includeOriginal;

  useEffect(() => { if (video.current) video.current.volume = volume; }, [volume, videoUrl]);
  useEffect(() => {
    const soundtrack = audio.current;
    const picture = video.current;
    return () => { playAttempt.current++; soundtrack?.pause(); picture?.pause(); };
  }, [soundtrackUrl, videoUrl]);

  function pausePicture() { playAttempt.current++; video.current?.pause(); }
  function syncPicture() {
    if (audio.current && video.current) video.current.currentTime = audio.current.currentTime;
  }
  function playPicture() {
    const picture = video.current;
    if (!picture || !audio.current || audio.current.paused) return;
    const attempt = ++playAttempt.current;
    setError("");
    syncPicture();
    void picture.play().catch(() => {
      if (attempt !== playAttempt.current) return;
      audio.current?.pause();
      setError("The video could not play alongside the soundtrack. Try Play again, or download both files to preview in your editor.");
    });
  }

  return <div className={styles.preview}>
    <div className={styles.previewHeading}><h4>{showcase ? "Watch VELUNE with voiceover" : "Listen with the picture"}</h4><span>{showcase ? "H3 Max picture · ElevenLabs voiceover" : "Playback preview"}</span></div>
    {videoUrl && originalAudioAvailable && <div className={styles.originalControls}>
      <label className={styles.toggle}><input type="checkbox" checked={nativeEnabled} onChange={(event) => setIncludeOriginal(event.target.checked)} />Include original video sound</label>
      <label className={styles.volume}>Original video volume · {Math.round(volume * 100)}%<input type="range" min={0} max={1} step={0.05} value={volume} disabled={!nativeEnabled} onChange={(event) => setVolume(Number(event.target.value))} /></label>
      <p>{showcase ? "Play the film with the supplied ElevenLabs voiceover. Keep this switch on to hear H3’s original sound too, and balance it with the volume slider. The video and voiceover downloads remain separate." : "Hear the sound generated with your video alongside this WAV. This switch and volume affect the preview only; original video sound is not added to the WAV or editor bundle."}</p>
    </div>}
    {videoUrl && !originalAudioAvailable && <p className={styles.previewNote}>Motion-guide picture. Original-sound playback becomes available when a generated video is ready.</p>}
    <audio aria-label="Mixed soundtrack playback" ref={audio} src={soundtrackUrl} controls className={styles.audio}
      onPlay={playPicture} onPlaying={playPicture} onPause={pausePicture} onWaiting={pausePicture}
      onSeeked={syncPicture} onEnded={pausePicture}
      onTimeUpdate={() => { if (audio.current && video.current && !audio.current.paused && !video.current.seeking && Math.abs(video.current.currentTime - audio.current.currentTime) > 0.3) syncPicture(); }} />
    {videoUrl && <video aria-label="Video synchronized to soundtrack" ref={video} src={videoUrl} muted={!nativeEnabled} playsInline preload="metadata" className={styles.video}
      onLoadedMetadata={syncPicture} onError={() => { audio.current?.pause(); setError("The video could not be loaded. Download the original video to check this mix in your editor."); }} />}
    {error && <p role="alert" className={styles.previewNote}>{error}</p>}
    <p className={styles.previewNote}>{showcase ? "Use the player above to play, pause or seek both tracks together. Switch original video sound off for voiceover only." : "Play, pause and seek with the soundtrack player. Check final synchronization and combined levels in your editor."}</p>
  </div>;
}
