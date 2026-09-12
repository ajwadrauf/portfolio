"use client";

import { useState } from "react";
import styles from "./RenderWaiting.module.css";

type Props = {
  starting: boolean;
  overdue: boolean;
  elapsed: string;
  modelName: string;
  requestId?: string;
  contactHref: string;
};

/**
 * Indeterminate activity, never an invented estimate of provider progress.
 *
 * The adapter reports pending, done or failed — no percentage — so the art is
 * decorative and the three stages come from the application's own phase rather
 * than from elapsed time. The copy is first person singular like the rest of
 * the site: there is no "we" here to be checking on anything.
 */
export function RenderWaiting({ starting, overdue, elapsed, modelName, requestId, contactHref }: Props) {
  const [paused, setPaused] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");

  const copyId = async () => {
    if (!requestId) return;
    try {
      await navigator.clipboard.writeText(requestId);
      setCopyStatus("Request ID copied");
    } catch {
      setCopyStatus("Select the request ID below to copy it.");
    }
  };

  return (
    <div className={styles.waiting} data-paused={paused} data-overdue={overdue}>
      <div className={styles.topline}>
        <span className={styles.brand}>AD LAB <span aria-hidden>/</span> IN MOTION</span>
        <button type="button" className={styles.motionToggle} onClick={() => setPaused((value) => !value)} aria-pressed={paused}>
          {paused ? "Play animation" : "Pause animation"}
        </button>
      </div>

      <div className={styles.art} aria-hidden="true">
        <div className={styles.grid} />
        <div className={styles.halo} />
        <div className={styles.frames}>
          <div className={`${styles.frame} ${styles.back}`} />
          <div className={`${styles.frame} ${styles.middle}`} />
          <div className={`${styles.frame} ${styles.front}`}>
            <div className={styles.picture}>
              <div className={styles.orb} />
              <div className={styles.ribbon} />
              <div className={styles.scan} />
            </div>
            <div className={styles.frameCode}><span>AJ / STUDIO</span><span>✦</span></div>
          </div>
        </div>
        <div className={styles.floor} />
      </div>

      <div className={styles.copy}>
        <p className={styles.kicker}><span className={styles.dot} />{starting ? "Sending request" : overdue ? "Longer than usual" : "Generation in progress"}</p>
        <div role="status" aria-live="polite" aria-atomic="true">
          <h3>{starting ? "A little direction.\nA lot of possibility." : overdue ? "Still working\non your film." : "Your idea,\nfinding its motion."}</h3>
          <p className={styles.message}>
            {starting
              ? "Sending your brief to the model. The request ID appears here once it is accepted."
              : overdue
                ? "This one is taking a little longer. I’m still checking for the result. There’s no need to submit again."
                : "The model has your brief. The finished film lands here as soon as it is ready. You can leave this tab while it renders."}
          </p>
        </div>
        <p className={styles.timer}><span>{elapsed}</span> elapsed <span className={styles.divider}>/</span> {modelName}</p>
        <ol className={styles.steps} aria-label="Request stages">
          <li data-state={starting ? "current" : "done"}><span aria-hidden>{starting ? "01" : "✓"}</span>Submitted</li>
          <li data-state={starting ? "next" : "current"}><span aria-hidden>02</span>Awaiting film</li>
          <li data-state="next"><span aria-hidden>03</span>Ready</li>
        </ol>
      </div>

      <div className={styles.footer}>
        {requestId && (
          <details>
            <summary>Request details</summary>
            <p>Keep this ID to collect the result from the recovery tools later.</p>
            <code>{requestId}</code>
            <button type="button" onClick={() => void copyId()}>Copy request ID</button>
            <span role="status">{copyStatus}</span>
          </details>
        )}
        {overdue && <a href={contactHref}>Report a delay <span aria-hidden>↗</span></a>}
      </div>
    </div>
  );
}
