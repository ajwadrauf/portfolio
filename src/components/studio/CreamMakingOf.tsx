"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { CreamCompare } from "./CreamCompare";
import { CREAM_REFERENCES, CREAM_REFERENCE_RULE } from "./creamReferences";
import { CREAM_FULL_PROMPT } from "./creamPrompt";
import styles from "./CreamMakingOf.module.css";

export function CreamMakingOf() {
  const [selected, setSelected] = useState(0);
  const [cue, setCue] = useState<{ time: number; key: number }>();
  const [copyStatus, setCopyStatus] = useState("");
  const reference = CREAM_REFERENCES[selected];

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setCopyStatus(`${label} copied.`); }
    catch { setCopyStatus("Copy is unavailable here. Select the prompt text, or download the full brief below."); }
  };

  const cueShot = () => {
    setCue((previous) => ({ time: reference.cue, key: (previous?.key ?? 0) + 1 }));
    const player = document.getElementById("cream-process-player");
    player?.focus({ preventScroll: true });
    player?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  return (
    <section className={styles.section} id="cream-making-of" aria-labelledby="cream-making-heading">
      <div className={styles.wrap}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Behind the film / 18 seconds / 5 references</p>
            <h2 id="cream-making-heading">The motion was planned.<br /><em>The flavour was directed.</em></h2>
          </div>
          <p>A Blender camera plan, five AI-generated stills and a written brief. Here’s how I brought them together for <strong>Cream in motion.</strong></p>
        </div>

        <div className={styles.overview}>
          <div className={styles.process}>
            <ol>
              <li><span>01</span><div><h3>Choreograph in Blender</h3><p>Seven shots define the camera, staging and main action. Simple colours identify the objects.</p></div></li>
              <li><span>02</span><div><h3>Direct with five images</h3><p>Packaging, food texture and material details each get a specific reference.</p></div></li>
              <li><span>03</span><div><h3>Give every input a role</h3><p>The brief connects each image to its shots and explains which decisions belong to the motion guide.</p></div></li>
              <li><span>04</span><div><h3>Generate and compare</h3><p>Seedance 2.5 interprets the combined direction. Play the actual result beside the guide to inspect what carried through.</p></div></li>
            </ol>
            <p className={styles.note}>Independent portfolio concept. Placeholder branding. Shot times describe the Blender plan; the generated take can interpret motion and timing differently.</p>
          </div>
          <CreamCompare compact id="cream-process-player" cue={cue} />
        </div>

        <div className={styles.referenceHeading}>
          <div><p className={styles.eyebrow}>The five inputs</p><h3>Each image has a job.</h3></div>
          <p>Select a reference to see its role and a prompt excerpt.</p>
        </div>
        <div className={styles.selector} role="group" aria-label="Explore the five image references">
          {CREAM_REFERENCES.map((item, index) => (
            <button type="button" key={item.id} aria-pressed={selected === index} aria-controls="cream-reference-detail" onClick={() => { setSelected(index); setCopyStatus(""); }}>
              <Image src={`/studio/cream/references/${item.id}.webp`} alt="" width={960} height={1720} sizes="(max-width: 600px) 30vw, 180px" />
              <span className={styles.imageNumber}>[Image{item.number}]</span>
              <span className={styles.imageName}>{item.short}</span>
            </button>
          ))}
        </div>

        <div className={styles.referenceDetail} id="cream-reference-detail" role="region" aria-labelledby="cream-reference-title">
          <figure>
            <Image src={`/studio/cream/references/${reference.id}.webp`} alt={reference.alt} width={960} height={1720} sizes="(max-width: 600px) 85vw, 320px" />
            <figcaption>[Image{reference.number}] · AI-generated appearance reference</figcaption>
          </figure>
          <div className={styles.direction}>
            <p className={styles.eyebrow}>{reference.shots}</p>
            <h3 id="cream-reference-title">{reference.title}</h3>
            <p>{reference.role}</p>
            <div className={styles.boundary}><h4>How the brief scopes it</h4><p>{reference.boundary}</p></div>
            <button type="button" className={styles.cue} onClick={cueShot}>Cue {reference.cueLabel} in both films <span aria-hidden>↑</span></button>
            <p className={styles.note}>This cues the planned shot and leaves playback paused for inspection.</p>
            <div className={styles.prompt}>
              <div className={styles.promptHead}><h4>From the direction brief</h4><button type="button" onClick={() => void copy(reference.prompt, "Excerpt")}>Copy excerpt</button></div>
              <p>{reference.prompt}</p>
            </div>
          </div>
        </div>

        <div className={styles.promptRecipe}>
          <div><p className={styles.eyebrow}>The prompt that joins them</p><h3>Motion first.<br />Appearance by reference.</h3><p>The five images are uploaded once, in the order above. [Video1] is the Blender motion guide. [Image1] is the same packaging reference in every shot that needs it.</p></div>
          <div className={styles.prompt}><div className={styles.promptHead}><h4>The reference-priority rule</h4><button type="button" onClick={() => void copy(CREAM_REFERENCE_RULE, "Reference rule")}>Copy rule</button></div><p>{CREAM_REFERENCE_RULE}</p></div>
        </div>

        <details className={styles.fullPrompt}>
          <summary>Read the full 18-second direction brief</summary>
          <p className={styles.note}>The consolidated brief prepared for this five-image setup. It asks for no generated audio; the supplied result includes audio. The displayed brief is the creative direction, not an export of the final API request settings.</p>
          <button type="button" className={styles.cue} onClick={() => void copy(CREAM_FULL_PROMPT, "Full brief")}>Copy full brief</button>
          <pre>{CREAM_FULL_PROMPT}</pre>
        </details>
        <p className={styles.copyStatus} role="status">{copyStatus}</p>
        <div className={styles.footer}>
          <a href="/studio/cream/direction-18s.txt" download>Download the full brief <span aria-hidden>↓</span></a>
          <Link href="/ai-studio/blender">Build your own Blender brief <span aria-hidden>↗</span></Link>
          <a href="#ad-lab-workspace">Back to Ad Lab <span aria-hidden>↑</span></a>
        </div>
      </div>
    </section>
  );
}
