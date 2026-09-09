"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CREAM_CHAPTERS,
  CREAM_DURATION,
  CREAM_COMPARISONS,
  videoType,
} from "./creamStudy";
import styles from "./CreamCompare.module.css";

/**
 * The Blender plan and supplied Seedance film, played as a pair. The two
 * original Blender passes remain available in the comparison selector.
 *
 * The comparison is the content, so the two panes are driven together: one
 * play control, one scrub, one chapter list, and a drift check that nudges the
 * follower back onto the leader while they run. That is coordinated playback
 * in a browser, not frame-locked synchronisation, and the section says so
 * rather than implying more than two <video> elements can promise.
 *
 * Nothing plays until someone asks. preload="none" and posters keep video
 * downloads off initial page load, and every path that stops playback —
 * scrolling away, hiding the tab, a source failing, unmounting — stops both
 * panes and puts the label back to what is actually true.
 */

type Status = { text: string; error?: boolean } | null;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
};

export function CreamCompare() {
  const [view, setView] = useState<string>(CREAM_COMPARISONS[0].id);
  const panes = (CREAM_COMPARISONS.find((c) => c.id === view) ?? CREAM_COMPARISONS[0]).panes;
  const [sound, setSound] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const panesRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(CREAM_DURATION);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  /*
   * What we are trying to do, as opposed to what the elements are doing.
   *
   * Every pause we cause ourselves arrives as a `pause` event on both panes.
   * Without this, handling those events would recurse; with it, an unexpected
   * pause — a stall, a decode failure on one side — is distinguishable, and
   * gets to stop the other pane rather than leaving one running alone.
   */
  const intent = useRef<"playing" | "paused">("paused");
  /** Bumped by every pause, seek and unmount, so a slow play() cannot win. */
  const playToken = useRef(0);
  /** A seek asked for before metadata existed, applied once it does. */
  const pendingSeek = useRef<number | null>(null);

  const videos = () =>
    videoRefs.current.filter((v): v is HTMLVideoElement => v !== null);

  /** preload="none" leaves readyState at 0; nudge just the metadata in. */
  const ensureLoaded = useCallback(() => {
    for (const v of videos()) {
      if (v.readyState === 0) {
        v.preload = "metadata";
        v.load();
      }
    }
  }, []);

  const pauseBoth = useCallback(() => {
    intent.current = "paused";
    playToken.current += 1;
    for (const v of videos()) v.pause();
    setPlaying(false);
  }, []);

  const seekBoth = useCallback(
    (to: number) => {
      const t = clamp(to, 0, duration);
      // A seek supersedes any play() still in flight from an earlier click.
      playToken.current += 1;
      pendingSeek.current = t;
      setCurrent(t);
      setEnded(false);
      ensureLoaded();
      for (const v of videos()) {
        if (v.readyState >= 1) v.currentTime = t;
      }
      if (videos().every((v) => v.readyState >= 1)) pendingSeek.current = null;
    },
    [duration, ensureLoaded],
  );

  const playBoth = useCallback(async () => {
    const all = videos();
    if (failed || all.length < panes.length) return;

    if (ended) seekBoth(0);
    intent.current = "playing";
    setStarted(true);
    setStatus(null);
    const token = ++playToken.current;

    try {
      await Promise.all(all.map((v) => v.play()));
    } catch {
      if (token === playToken.current) {
        pauseBoth();
        setStatus({
          text: "The browser would not start playback here. Open either pass full size below.",
          error: true,
        });
      }
      return;
    }

    // Paused, seeked, navigated or unmounted while play() was resolving.
    if (token !== playToken.current) {
      for (const v of all) v.pause();
      return;
    }
    setPlaying(true);
  }, [ended, failed, panes.length, pauseBoth, seekBoth]);

  const toggle = useCallback(() => {
    if (playing) pauseBoth();
    else void playBoth();
  }, [playing, pauseBoth, playBoth]);

  const restart = useCallback(() => {
    seekBoth(0);
    void playBoth();
  }, [seekBoth, playBoth]);

  const changeComparison = (next: string) => {
    if (next === view) return;
    pauseBoth();
    for (const v of videos()) if (v.readyState >= 1) v.currentTime = 0;
    pendingSeek.current = null;
    setCurrent(0);
    setDuration(CREAM_DURATION);
    setEnded(false);
    setStarted(false);
    setFailed(false);
    setStatus(null);
    setSound(false);
    setView(next);
  };

  /*
   * Drift correction.
   *
   * Two elements decoding two files will not stay locked; left is the leader
   * and anything more than about four frames behind gets pulled back. The
   * threshold is deliberately loose — correcting smaller gaps is audible as
   * stutter and buys nothing you can see.
   */
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const [leader, ...rest] = videos();
      if (!leader || leader.paused) return;
      for (const v of rest) {
        if (!v.paused && Math.abs(v.currentTime - leader.currentTime) > 0.15) {
          v.currentTime = leader.currentTime;
        }
      }
    }, 400);
    return () => window.clearInterval(id);
  }, [playing]);

  /* Scrolled away, or the tab went to the background: stop both. */
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pauseBoth();
    };
    document.addEventListener("visibilitychange", onVisibility);

    /*
     * Watch the players, not the section around them.
     *
     * The section is tall — a whole intro column on desktop, and on a phone
     * the copy sits an entire screen above the panes. Observing it meant the
     * films kept decoding while nothing of them was on screen, which is the
     * exact cost this is meant to avoid.
     */
    const panes = panesRef.current;
    const observer =
      typeof IntersectionObserver === "undefined" || !panes
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (!entries[0].isIntersecting) pauseBoth();
            },
            { threshold: 0 },
          );
    if (panes) observer?.observe(panes);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      // Unmount is also a supersede: a play() resolving after this must not
      // restart panes that are on their way out.
      playToken.current += 1;
      intent.current = "paused";
      for (const v of videoRefs.current) v?.pause();
    };
  }, [pauseBoth]);

  const activeChapter = CREAM_CHAPTERS.findIndex(
    (c) => current >= c.from && current < c.to,
  );
  const chapter = CREAM_CHAPTERS[activeChapter] ?? CREAM_CHAPTERS[0];

  const toggleLabel = failed
    ? "Unavailable"
    : ended
      ? "Replay both"
      : playing
        ? "Pause both"
        : "Play both";

  return (
    <section className={styles.section} id="motion-study" aria-labelledby="cream-heading">
      <div className={styles.wrap}>
        <div className={styles.body}>
          <div className={styles.head}>
            <p className={styles.eyebrow}>Featured study</p>
              <h2 className={styles.title} id="cream-heading">
                Cream in motion.
              </h2>
              <p className={styles.standfirst}>
                Directed in Blender. Finished with Seedance.
              </p>
              <p className={styles.explain}>
                A camera plan built in Blender. Five references for packaging and
                food texture. An 18-second film generated with Seedance. Play them
                together to see the transformation.
              </p>
              <p className={styles.caveat}>
                Vanilla, chocolate and strawberry. An independent portfolio
                concept with placeholder branding. Each pass is labelled by how
                it was made.
              </p>
          </div>

          <div className={styles.players}>
            <div className={styles.comparisons} role="group" aria-label="Choose comparison">
              {CREAM_COMPARISONS.map((comparison) => (
                <button
                  type="button"
                  key={comparison.id}
                  aria-pressed={view === comparison.id}
                  onClick={() => changeComparison(comparison.id)}
                >
                  {comparison.label}
                </button>
              ))}
            </div>
            <div className={styles.panes} ref={panesRef}>
              {panes.map((pane, i) => (
                <div className={styles.pane} key={pane.id}>
                  <div className={styles.stage}>
                    <video
                      ref={(el) => {
                        videoRefs.current[i] = el;
                      }}
                      poster={pane.poster}
                      preload="none"
                      playsInline
                      muted={!sound || !pane.hasAudio}
                      aria-label={`${pane.label}, ${pane.spec}. ${pane.provenance}.`}
                      onClick={toggle}
                      onLoadedMetadata={(e) => {
                        const v = e.currentTarget;
                        if (i === 0 && Number.isFinite(v.duration) && v.duration > 0) {
                          setDuration(v.duration);
                        }
                        if (pendingSeek.current !== null) {
                          v.currentTime = pendingSeek.current;
                          if (videos().every((x) => x.readyState >= 1)) {
                            pendingSeek.current = null;
                          }
                        }
                      }}
                      onTimeUpdate={(e) => {
                        if (i === 0) setCurrent(e.currentTarget.currentTime);
                      }}
                      onPlay={() => {
                        if (intent.current === "playing") setPlaying(true);
                      }}
                      onPause={() => {
                        // Only an unexpected stop reaches here as work to do.
                        if (intent.current === "playing") pauseBoth();
                      }}
                      onWaiting={() => {
                        if (intent.current === "playing") {
                          setStatus({ text: "Buffering…" });
                        }
                      }}
                      onPlaying={() => setStatus(null)}
                      onEnded={() => {
                        intent.current = "paused";
                        for (const v of videos()) v.pause();
                        setPlaying(false);
                        setEnded(true);
                        setCurrent(duration);
                      }}
                      onError={() => {
                        pauseBoth();
                        setFailed(true);
                        setStatus({
                          text: `${pane.label} could not be loaded. Try another comparison or open a file directly below.`,
                          error: true,
                        });
                      }}
                    >
                      <source src={pane.src} type={videoType(pane.src)} />
                    </video>

                    <button
                      type="button"
                      className={styles.play}
                      hidden={playing}
                      onClick={toggle}
                      aria-label={
                        ended ? "Replay both videos" : "Play both videos together"
                      }
                    >
                      <span className={styles.playBadge} aria-hidden>
                        {ended ? "↻" : "▶"}
                      </span>
                    </button>
                  </div>

                  <p className={styles.paneLabel}>
                    <span>{pane.label}</span>
                    <span className={styles.paneSpec}>{pane.spec}</span>
                  </p>
                  {/*
                    How this pass was made, on screen and not only in the
                    aria-label. The caveat above promises that each pass is
                    labelled by how it was made; with a real generative result
                    now sitting beside two authored renders, that promise has
                    to be visible to the people most likely to mistake one for
                    the other.
                  */}
                  <p className={styles.paneProvenance}>{pane.provenance}</p>
                  <p className={styles.paneNote}>{pane.note}</p>
                </div>
              ))}
            </div>

            <div className={styles.controls}>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={toggle}
                disabled={failed}
              >
                {toggleLabel}
                <span aria-hidden>{playing ? "❙❙" : ended ? "↻" : "▶"}</span>
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={restart}
                disabled={failed}
              >
                Restart
              </button>
              {panes.some((pane) => pane.hasAudio) && (
                <button
                  type="button"
                  className={styles.button}
                  aria-pressed={sound}
                  onClick={() => setSound((value) => !value)}
                >
                  {sound ? "Sound on" : "Sound off"}
                </button>
              )}
              <div className={styles.scrubRow}>
                <input
                  type="range"
                  className={styles.scrub}
                  min={0}
                  max={duration}
                  step={0.05}
                  value={clamp(current, 0, duration)}
                  disabled={failed}
                  aria-label="Playback position, in seconds, for both passes"
                  onChange={(e) => seekBoth(Number(e.target.value))}
                />
                <span className={styles.time}>
                  {clock(current)} / {clock(duration)}
                </span>
              </div>
            </div>

            <div className={styles.chapterHead}>
              <p className={styles.eyebrow}>Seven shots</p>
              <p className={styles.time}>
                {started ? "Coordinated playback" : "Press play to load the videos"}
              </p>
            </div>
            <ul className={styles.chapters}>
              {CREAM_CHAPTERS.map((c, i) => (
                <li key={c.name}>
                  <button
                    type="button"
                    className={`${styles.chapter} ${i === activeChapter ? styles.chapterActive : ""}`}
                    onClick={() => seekBoth(c.from)}
                    disabled={failed}
                    aria-current={i === activeChapter ? "true" : undefined}
                  >
                    {c.name}
                    <span className={styles.chapterTime} aria-hidden>
                      {c.from}s
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.chapterAction}>{chapter.action}</p>
            <p className={styles.paneNote}>Shot cues follow the Blender plan. Timing in the generated film may vary.</p>

            {status && (
              <p
                className={`${styles.status} ${status.error ? styles.statusError : ""}`}
                role="status"
              >
                {status.text}
              </p>
            )}

            <div className={styles.openLinks}>
              {panes.map((pane) => (
                <a
                  key={pane.id}
                  className={styles.openLink}
                  href={pane.src}
                  target="_blank"
                  rel="noreferrer"
                >
                  {pane.openLabel} <span aria-hidden>↗</span>
                </a>
              ))}
            </div>
          </div>

          <div className={styles.deeper}>
            <Link href="/ai-studio/blender" className="btn-block btn-block-light">
              Build a Blender brief <span aria-hidden>↗</span>
            </Link>
            <Link href="/ai-studio/ads" className="btn-block btn-block-light">
              Open Ad Lab <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
