import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { weaveUrl } from "@/app/ai-studio/workflows/study";
import { SoundtrackPreview } from "@/components/ad/SoundtrackPreview";
import { VELUNE_PACKAGE_PANELS } from "@/lib/velunePackaging";
import { Wordmark } from "@/components/Wordmark";
import { VelunePlayer } from "@/components/velune/VelunePlayer";
import { VeluneMotionStudy } from "@/components/velune/VeluneMotionStudy";
import { VeluneSectionNav } from "@/components/velune/VeluneSectionNav";
import { VELUNE_MEDIA } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES } from "@/lib/veluneReferences";
import styles from "@/components/velune/Velune.module.css";

export const metadata: Metadata = {
  title: "VELUNE · a chocolate campaign & creative process · Ajwad Rauf",
  description: "An independent chocolate campaign from brief to delivery, with ComfyUI and Figma Weave carton studies, H3 film, ElevenLabs voiceover and editable After Effects motion.",
};

const DECISIONS = [
  { title: "Make curiosity visible", body: "Open on a narrow chocolate passage. Save the wide view and the three filled centres for the reveal." },
  { title: "Move the right thing", body: "Keep the fork and chocolate still while observers move. Pull back to reveal the chocolatiers already at work." },
  { title: "Give the eye time", body: "Cut quickly through the three cartons, then hold The Centre Report for three seconds so it can be read." },
] as const;

const STAGES = [
  { title: "Adapt the choreography", body: "Translate the reference edit into an independent brand, packaging and sound direction." },
  { title: "Block the shots", body: "Use Blender to settle framing, timing, product positions and camera moves." },
  { title: "Direct the H3 take", body: "Use nine images to guide the cartons, ingredients, studio gestures and final reveal." },
  { title: "Finish and adapt", body: "Replace the carton inserts, typeset the report, mix the sound and adapt the campaign across formats." },
] as const;

const REFERENCE_GROUPS = [
  { id: "cartons", title: "The three cartons", note: "Match the angle and scale of each pack across the quick cuts.", indices: [1, 2, 3] },
  { id: "ingredients", title: "Ingredients", note: "Give the berry and pistachio their own macro shots.", indices: [4, 5] },
  { id: "chocolate", title: "The serving", note: "One pistachio half for the fork reveal. All three centres for the plate.", indices: [6] },
  { id: "world", title: "The studio and chocolate world", note: "Direct the working gestures and give the opening and closing different compositions.", indices: [7, 8, 9] },
] as const;

const VOICE = [
  { window: "00.29–01.21", text: "What’s within?" },
  { window: "03.29–04.58", text: "Something wonderful." },
  { window: "10.38–12.42", text: "Velune. The Centre Report." },
  { window: "13.42–14.63", text: "Wonder within." },
] as const;

export default function VelunePage() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#velune-main">Skip to study</a>
      <header className={`${styles.wrap} ${styles.nav}`}>
        <Link href="/" aria-label="Ajwad Rauf, homepage"><Wordmark size="md" /></Link>
        <nav aria-label="Project navigation"><Link href="/#ar-work">← All work</Link><Link href="/ai-studio">The Workroom ↗</Link></nav>
      </header>
      <main id="velune-main" tabIndex={-1}>
        <section className={styles.heroCover} aria-labelledby="velune-title">
          <div className={`${styles.wrap} ${styles.hero}`}>
            <div>
              <p className={styles.eyebrow}>Independent chocolate campaign</p>
              <h1 id="velune-title">VELUNE<span>Wonder within.</span></h1>
              <p className={styles.lead}>Three filled chocolates, one small moment of discovery. A 15-second campaign from camera plan to final cut.</p>
              <div className={styles.heroJumps}>
                <a className={styles.cta} href="#campaign-brief">Explore the campaign <span aria-hidden>↓</span></a>
                <a className={styles.referenceJump} href="#velune-film">Jump to the finished film <span aria-hidden>↓</span></a>
              </div>
              <nav className={styles.toolNav} aria-labelledby="velune-tools">
                <p className={styles.eyebrow} id="velune-tools">Tools used</p>
                <ul>
                  <li><a href="#camera-study">Blender</a></li>
                  <li><a href="#creative-review">H3 Max</a></li>
                  <li><a href="#sound-direction">ElevenLabs</a></li>
                  <li><a href="#after-effects">After Effects</a></li>
                  <li><Link href="/ai-studio/workflows#workflow-graphs">ComfyUI</Link></li>
                  <li><a href={weaveUrl} target="_blank" rel="noreferrer">Figma Weave <span aria-hidden>↗</span></a></li>
                </ul>
              </nav>
            </div>
            <div className={styles.heroVisual}>
              <figure>
                <Image src="/studio/velune/references/v2/02_velune_raspberry_carton.jpeg" width={1672} height={941} sizes="(max-width: 800px) 94vw, 600px" loading="eager" alt="VELUNE Raspberry Ganache carton on the original burgundy set" />
                <figcaption>Raspberry Ganache <span>Carton reference</span></figcaption>
              </figure>
              <dl aria-label="Campaign film at a glance">
                <div><dt>Format</dt><dd>15 sec · 16:9</dd></div>
                <div><dt>Edit</dt><dd>360 frames · 24&nbsp;fps</dd></div>
                <div><dt>Structure</dt><dd>12 shots · 11 cuts</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <VeluneSectionNav />

        <section className={`${styles.wrap} ${styles.section}`} id="campaign-brief" aria-labelledby="brief-heading" tabIndex={-1}>
          <div className={styles.sectionHead}>
            <div><p className={styles.eyebrow}>Campaign brief</p><h2 id="brief-heading">What’s within?</h2></div>
            <p>Build anticipation for the first bite. Let the film reveal the three centres, then carry that idea into stills and social.</p>
          </div>
          <dl className={styles.campaignBrief}>
            <div><dt>Audience</dt><dd>Adults drawn to distinctive chocolate and small moments of indulgence.</dd></div>
            <div><dt>Objective</dt><dd>Introduce VELUNE and make its three filled centres memorable.</dd></div>
            <div><dt>Delivery</dt><dd>A 15-second film, campaign still, vertical social layout and English/French still.</dd></div>
          </dl>
          <Link className={styles.referenceJump} href="/velune/treatment">Read the creative treatment <span aria-hidden>↗</span></Link>

          <section className={styles.credits} id="my-role" aria-labelledby="role-heading" tabIndex={-1}>
            <div><h3 id="role-heading">My role</h3><p>I adapted the concept, directed the film, selected references and reviewed the work through finishing. AI assisted the brief, code and imagery.</p></div>
            <div><h3>Study notes</h3><p>VELUNE is an independent fictional campaign. The case study includes final deliverables and source files.</p></div>
          </section>
        </section>

        <section className={styles.cinema} id="camera-study" aria-labelledby="camera-heading" tabIndex={-1}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Blender animatic</p><h2 id="camera-heading">Camera and choreography</h2></div><p id="velune-video-description">Select any of the 12 shots to see how the Blender guide sets the framing, timing and movement.</p></div>
            <VelunePlayer />
            <p className={styles.mediaNote}>The H3 direction revised the opening, closing, studio gestures and serving. <a href="#visual-references">See the visual references ↓</a></p>
            <Link className={styles.referenceJump} href="/ai-studio#studio-start">Explore the editable VELUNE studio example <span aria-hidden>↗</span></Link>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section}`} id="creative-direction" aria-labelledby="decisions-heading" tabIndex={-1}>
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Creative decisions</p><h2 id="decisions-heading">Every move has a job.</h2></div><p>Three choices set the pace, from the first glimpse inside to a quiet moment to read.</p></div>
          <div className={styles.decisions}>{DECISIONS.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
          <div className={styles.judgment} id="creative-review" tabIndex={-1}>
            <div className={styles.judgmentHeading}><p className={styles.eyebrow}>Film frame at 2.375 seconds</p><h3>Replacing the proxy carton</h3><p>The generated film briefly brought back the flat Blender artwork. I kept the edit and replaced the three carton inserts with the chosen reference images.</p></div>
            <div className={styles.comparisonGrid}>
              <figure><Image src="/studio/velune/delivery/carton-before.jpg" width={1344} height={768} alt="Source H3 frame at 2.375 seconds: the raspberry carton has flat proxy artwork" sizes="(max-width: 760px) 90vw, 45vw" /><figcaption><strong>Before · H3 source take</strong><span>At 2.375s, the flat shield graphic replaces the intended chocolate photograph.</span></figcaption></figure>
              <figure><Image src="/studio/velune/delivery/carton-after.jpg" width={1920} height={1080} alt="Finished frame at 2.375 seconds: selected raspberry carton artwork shows the whole bonbon and exposed filling" sizes="(max-width: 760px) 90vw, 45vw" /><figcaption><strong>After · Local finishing</strong><span>The selected cover restores paper texture, carton depth and the visible raspberry centre.</span></figcaption></figure>
            </div>
            <Link className={styles.referenceJump} href="/ai-studio/workflows">Explore the separate ComfyUI and Figma Weave carton study <span aria-hidden>↗</span></Link>
          </div>
          <div className={styles.repairs}>
            <h3>What changed in Blender.</h3>
            <dl>
              <div><dt>A controlled chocolate merge</dt><dd>The original spread surface folded through itself. Twenty baked meshes now define the transition frame by frame, with the opening filled by frame 100.</dd></div>
              <div><dt>A readable centre</dt><dd>The macro piece was rebuilt as a rounded cut shell with a separate recessed filling. Corrected fork contact keeps the support and product together.</dd></div>
              <div><dt>Colour and lettering that hold</dt><dd>Reduced product lighting preserves the three package colours. Camera-space title and tagline artwork keep those words stable through the edit.</dd></div>
            </dl>
          </div>
          <details className={styles.reveal}>
            <summary>View the Blender contact sheet</summary>
            <figure className={styles.contactSheet}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={VELUNE_MEDIA.contactSheet} width={1280} height={1632} alt="Thirty representative poses from the actual VELUNE Blender camera study, including the question-mark assembly, observer arcs and studio pullback" loading="lazy" />
              <figcaption>Camera-study contact sheet · Actual Blender frames <a href={VELUNE_MEDIA.contactSheet} target="_blank" rel="noreferrer">Open full image ↗</a></figcaption>
            </figure>
          </details>
        </section>

        <section className={styles.referenceSection} id="visual-references" aria-labelledby="references-heading" tabIndex={-1}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div><p className={styles.eyebrow}>Appearance direction</p><h2 id="references-heading">Visual references</h2></div>
              <p>Nine AI-generated stills guide the look in H3. The numbers match their upload order.</p>
            </div>
            <div className={styles.referenceActions}><Link className={styles.cta} href="/ai-studio/ads">Try this direction in Motion <span aria-hidden>↗</span></Link><a className={styles.referenceJump} href="/studio/velune/velune_h3_v2_pack.zip" download>Download the named images & H3 prompt <span aria-hidden>↓</span></a><p>In Motion, choose “Load VELUNE example” for the images, Blender guide and H3 Max settings.</p></div>
            <div className={styles.referenceProvenance}>
              <p><strong>Appearance</strong>Supplied AI reference images</p>
              <p><strong>Movement</strong>Original Blender camera layouts</p>
              <p><strong>Lettering</strong>Separate report master & final type check</p>
            </div>
            {REFERENCE_GROUPS.map((group) => (
              <div className={`${styles.referenceGroup} ${group.id === "chocolate" ? styles.servingReference : ""}`} key={group.id}>
                <div className={styles.referenceGroupHead}><h3>{group.title}</h3><p>{group.note}</p></div>
                <div className={`${styles.referenceGrid} ${group.indices.length === 3 ? styles.productReferenceGrid : ""}`}>
                  {VELUNE_REFERENCES.filter((reference) => (group.indices as readonly number[]).includes(reference.index)).map((reference) => (
                    <figure className={styles.referenceCard} key={reference.id}>
                      <a className={styles.referenceImage} href={reference.url} target="_blank" rel="noreferrer" aria-label={`Open ${reference.title} reference image in a new tab`}>
                        <Image src={reference.url} width={reference.width} height={reference.height} alt={`Supplied AI-generated VELUNE reference: ${reference.title}`} sizes={group.indices.length === 3 ? "(max-width: 560px) calc(100vw - 44px), (max-width: 1000px) 33vw, 410px" : "(max-width: 560px) calc(100vw - 44px), (max-width: 1000px) 47vw, 620px"} />
                        <span className={styles.referenceOpen} aria-hidden="true">View image ↗</span>
                      </a>
                      <figcaption>
                        <span className={styles.referenceIndex}>Reference {String(reference.index).padStart(2, "0")}</span>
                        <h4>{reference.title}</h4>
                        <span className={styles.referenceShots}>Shots {reference.shotIds.join(" / ")}</span>
                        <details className={styles.shotNotes}><summary>Direction notes</summary><p>{reference.role}</p></details>
                        <a className={styles.referenceDownload} href={reference.url} download={reference.fileName}>Download JPEG ↓</a>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
            <p className={styles.referenceFootnote}>Loading the motion example creates a separate working copy.</p>
          </div>
        </section>

        <section className={styles.artSection} id="package-design" aria-labelledby="art-heading" tabIndex={-1}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Package design</p><h2 id="art-heading">Three flavours. One family.</h2></div><p>Six views of the Pistachio Praline carton show how the artwork wraps from the front to the information panel.</p></div>
            <div className={styles.panelGallery}>{VELUNE_PACKAGE_PANELS.map((panel) => <figure key={panel.face}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={panel.url} alt={`VELUNE pistachio carton reference: ${panel.face} panel`} loading="lazy" />
              <figcaption><strong>{panel.label}</strong><a href={panel.url} download>Download reference ↓</a></figcaption>
            </figure>)}</div>
            <Link className={styles.referenceJump} href="/ai-studio/packshots">Explore the six-face packshot example ↗</Link>
            <p className={styles.mediaNote}>In Packshots, open Artwork & dielines and choose “Load VELUNE carton artwork” to see all six faces mapped to the box.</p>
            <details className={styles.originalArtwork}><summary>Original flat artwork used in the Blender guide</summary>
            <figure className={styles.packaging}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={VELUNE_MEDIA.packaging} width={1440} height={904} alt="Three flat VELUNE package fronts: Pistachio Praline, Raspberry Ganache and Salted Caramel" loading="lazy" />
              <figcaption>Original flat concept artwork · Package lettering and illustrations, separate from the AI-generated appearance studies above.</figcaption>
            </figure>
            </details>
            <div className={styles.reportRow}>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/studio/velune/finishing/velune_centre_report_v2.svg" width={1920} height={1080} alt="Revised Centre Report with individual VELUNE carton photographs above the three exposed chocolate centres" loading="lazy" />
                <figcaption>The Centre Report · Typeset finishing artwork</figcaption>
              </figure>
              <div><h3>The Centre Report</h3><p>I replaced the generated report with a typeset graphic so the packaging, fillings and text read clearly in the held shot.</p><a className={styles.referenceJump} href="/studio/velune/finishing/velune_centre_report_v2.svg" download>Download the report master ↓</a></div>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section}`} id="production-workflow" aria-labelledby="workflow-heading" tabIndex={-1}>
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Production workflow</p><h2 id="workflow-heading">From brief to final cut</h2></div></div>
          <ol className={styles.stages}>{STAGES.map((stage, index) => <li key={stage.title}><span className={styles.stageNumber} aria-hidden>{index + 1}</span><h3>{stage.title}</h3><p>{stage.body}</p></li>)}</ol>
        </section>

        <section className={styles.soundSection} id="sound-direction" aria-labelledby="sound-heading" tabIndex={-1}>
          <div className={`${styles.wrap} ${styles.soundGrid}`}>
            <div><p className={styles.eyebrow}>Sound direction</p><h2 id="sound-heading">Room to listen</h2><p>Four short lines leave space for the reveal. The mix lowers the original H3 sound underneath the ElevenLabs voiceover.</p><Link className={styles.cta} href="/ai-studio/ads#ad-sound">Explore the sound workflow <span aria-hidden>↗</span></Link></div>
            <div className={styles.voice}><p className={styles.eyebrow}>Proposed voice windows / seconds</p>{VOICE.map((line) => <div key={line.window}><span>{line.window}</span><blockquote>“{line.text}”</blockquote></div>)}<p className={styles.pronunciation}>VELUNE is pronounced veh-LOON. The final film uses the supplied recording’s timing.</p></div>
          </div>
        </section>

        <VeluneMotionStudy />

        <section className={`${styles.cinema} ${styles.delivery}`} id="velune-film" aria-labelledby="film-heading" tabIndex={-1}>
          <div className={styles.wrap}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>Finished campaign</p><h2 id="film-heading">Wonder within.</h2></div><p>The final 15-second film brings together the corrected cartons, typeset report and mixed sound.</p></div>
            <video className={styles.finalVideo} src={VELUNE_MEDIA.finalFilm} poster={VELUNE_MEDIA.finalPoster} controls playsInline preload="none" aria-label="VELUNE finished fifteen-second campaign film with mixed sound">Your browser does not support video. Download the final MP4 below.</video>
            <div className={styles.filmDownloads}><a href={VELUNE_MEDIA.finalFilm} download>Download final MP4 ↘</a><a href={VELUNE_MEDIA.deliveryBundle} download>Download campaign set ↘</a><a href={VELUNE_MEDIA.finalMix} download>Download mixed WAV ↘</a></div>
            <p className={styles.deliveryNote}>1920 × 1080 · 24 fps · 15 seconds · Stereo sound. Finished from the supplied 768p H3 take.</p>
            <div className={styles.adaptations} id="campaign-formats" aria-label="Campaign adaptations" tabIndex={-1}>
              <figure><div className={styles.adaptationMedia}><a href={VELUNE_MEDIA.campaignStill} target="_blank" rel="noreferrer"><Image src={VELUNE_MEDIA.campaignStill} width={1920} height={1080} alt="VELUNE campaign still with the three filled chocolates and Wonder within headline" sizes="(max-width: 760px) 90vw, 33vw" /></a></div><figcaption><span className={styles.eyebrow}>Campaign still · 16:9</span><h3>A single reveal.</h3><p>The product sits at left, with the brand and headline in the quieter space at right.</p><a href={VELUNE_MEDIA.campaignStill} download>Download 1920 × 1080 PNG ↓</a></figcaption></figure>
              <figure><div className={styles.adaptationMedia}><video src={VELUNE_MEDIA.verticalFilm} poster={VELUNE_MEDIA.verticalPoster} controls playsInline preload="none" aria-label="VELUNE vertical social layout with embedded sound" /></div><figcaption><span className={styles.eyebrow}>Vertical social layout · 9:16</span><h3>Give the film a new frame.</h3><p>A portrait layout keeps the complete film visible, with larger brand and headline type around it.</p><a href={VELUNE_MEDIA.verticalFilm} download>Download 1080 × 1920 MP4 ↓</a></figcaption></figure>
              <figure><div className={styles.adaptationMedia}><a href={VELUNE_MEDIA.bilingualStill} target="_blank" rel="noreferrer"><Image src={VELUNE_MEDIA.bilingualStill} width={1080} height={1350} alt="Bilingual VELUNE still with Wonder within and Un monde à découvrir beneath the three filled chocolates" sizes="(max-width: 760px) 90vw, 33vw" /></a></div><figcaption><span className={styles.eyebrow}>English / French still · 4:5</span><h3>Carry the idea across.</h3><p>“Un monde à découvrir.” adapts the discovery idea. Both languages have equal space and visual weight.</p><a href={VELUNE_MEDIA.bilingualStill} download>Download 1080 × 1350 PNG ↓</a></figcaption></figure>
            </div>
            <details className={styles.sourceCompare}><summary>Compare original sound and voiceover</summary><p>Play the original H3 take and switch its sound on or off alongside the voiceover.</p><SoundtrackPreview soundtrackUrl={VELUNE_MEDIA.voiceover} videoUrl={VELUNE_MEDIA.film} originalAudioAvailable context="showcase" initialOriginal /><div className={styles.filmDownloads}><a href={VELUNE_MEDIA.film} download>Original H3 take ↓</a><a href={VELUNE_MEDIA.voiceover} download>Original voiceover WAV ↓</a><a href="/studio/velune/delivery/delivery-manifest.json" download>File specifications & finishing notes ↓</a></div></details>
            <div className={styles.deliveryLinks}><a className={styles.deliveryBack} href="#camera-study">Revisit the Blender guide ↑</a><Link className={styles.deliveryBack} href="/#ar-work">Back to selected work ↗</Link></div>
          </div>
        </section>
      </main>
      <footer className={`${styles.wrap} ${styles.footer}`}><span>Ajwad Rauf · Toronto · 2026</span><a href="mailto:hello@ajwadrauf.com">hello@ajwadrauf.com ↗</a></footer>
    </div>
  );
}
