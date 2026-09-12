import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { VelunePlayer } from "@/components/velune/VelunePlayer";
import { VELUNE_MEDIA } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES } from "@/lib/veluneReferences";
import styles from "@/components/velune/Velune.module.css";

export const metadata: Metadata = {
  title: "VELUNE — a chocolate film in production · Ajwad Rauf",
  description: "Inside a fifteen-second fictional chocolate concept: a Blender camera study, nine AI-generated appearance references for the revised H3 take, original package artwork and a planned film finish.",
};

const DECISIONS = [
  { n: "01", title: "Make curiosity visible.", body: "A tight, empty chocolate opening asks the question. A wider passage reveals three filled centres at the end. The revised direction gives curiosity a visible payoff.", detail: "Tight opening → discovery → three-centre reveal" },
  { n: "02", title: "Move the right thing.", body: "The macro fork stays still while soft background figures move. In the studio, a backward camera move reveals workers already tasting and gesturing. Small actions bring the setting to life.", detail: "Registered product / working gestures / real parallax" },
  { n: "03", title: "Give the eye time.", body: "Three quick carton cuts establish the flavour family. Later, The Centre Report holds for three seconds. The fastest and quietest moments have different jobs.", detail: "3 × 9-frame cartons / 72-frame reading interval" },
] as const;

const STAGES = [
  { n: "01", title: "Adapt the choreography", state: "Brief & artwork", body: "An existing shot structure becomes a new fictional chocolate world. Brand, product, report artwork and proposed sound are new creative; reference performers and branded footage are not reproduced here." },
  { n: "02", title: "Build the camera study", state: "Guide ready", body: "Geometry makes the timing, framing, object count and camera route reviewable. This preview is a working animatic; material quality and character performance remain provisional." },
  { n: "03", title: "Develop the appearance", state: "Revision 2 ready", body: "The first H3 take informed nine new images. Individual cartons, ingredient detail, working gestures and distinct bookends now guide the next take. The original Blender video stays unchanged." },
  { n: "04", title: "Audition, mix, finish", state: "Planned", body: "Audition original narration, a structured instrumental score and selected effects through ElevenLabs. Place the separate stems in the edit and check the complete film before calling it finished." },
] as const;

const REFERENCE_GROUPS = [
  { id: "cartons", title: "A carton for every flavour", note: "Individual references give each fast carton cut its own paper texture, depth and exposed centre. Register their camera angles without mirroring the lettering.", indices: [1, 2, 3], columns: 3 },
  { id: "chocolate", title: "Three centres. One serving.", note: "The dish brings all three flavours together. Its left pistachio half also guides the solo fork reveal; the studio reference supplies the whole bonbon shape.", indices: [6], columns: 2 },
  { id: "ingredients", title: "Real detail starts with a reference", note: "The raspberry and opened pistachio now have dedicated ingredient images, separate from the filled chocolates.", indices: [4, 5], columns: 2 },
  { id: "world", title: "Give the world a little life", note: "A working gesture replaces the posed stillness. A tight, empty opening and a wider product reveal make the beginning and ending distinct.", indices: [7, 8, 9], columns: 2 },
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
        <nav aria-label="Project navigation"><Link href="/#ar-work">← All work</Link><Link href="/ai-studio">AI Content Studio ↗</Link></nav>
      </header>
      <main id="velune-main">
        <section className={`${styles.wrap} ${styles.hero}`}>
          <div>
            <p className={styles.eyebrow}>Independent fictional concept / Film study 02</p>
            <h1>VELUNE<span>Wonder within.</span></h1>
            <p className={styles.lead}>A small chocolate contains a world of discovery. The challenge is making that world read in fifteen seconds.</p>
            <a className={styles.cta} href="#camera-study">Watch the camera study <span aria-hidden>↓</span></a>
            <a className={styles.referenceJump} href="#visual-references">Explore the revised appearance references <span aria-hidden="true">↓</span></a>
          </div>
          <aside className={styles.heroNote}>
            <span className={styles.status}>Revision 2 · Ready for the next take</span>
            <p>The first H3 take showed where the direction needed more clarity. Nine new stills now guide the next render; the final film and mix are still in production.</p>
            <dl><div><dt>Format</dt><dd>15 seconds / 16:9</dd></div><div><dt>Edit target</dt><dd>360 frames / 24 fps</dd></div><div><dt>Structure</dt><dd>12 shots / 11 hard cuts</dd></div><div><dt>Project</dt><dd>Independent concept</dd></div></dl>
          </aside>
        </section>

        <section className={styles.cinema} id="camera-study" aria-labelledby="camera-heading">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>01 / Camera & choreography</p><h2 id="camera-heading">Direct the movement.<br /><em>Then build the finish.</em></h2></div><p id="velune-video-description">A silent Blender animatic, from the chocolate tunnel and three-flavour montage to a laboratory reveal, printed report and final return. Select any shot below to inspect the plan.</p></div>
            <VelunePlayer />
            <Link className={styles.cta} href="/ai-studio#studio-start">Explore the editable VELUNE studio example <span aria-hidden>↗</span></Link>
            <p className={styles.mediaNote}>Original Blender guide, unchanged. The revised H3 prompt replaces the opening and ending, adds working gestures and changes the serving to three centres. Those updates are shown in the reference images below, not in this animatic.</p>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="decisions-heading">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>02 / The direction</p><h2 id="decisions-heading">Every move has a job.</h2></div><p>The inherited shot rhythm provides the structure. Chocolate-specific forms, restrained colour and deliberate moments of stillness give VELUNE its own story.</p></div>
          <div className={styles.decisions}>{DECISIONS.map((item) => <article key={item.n}><span className={styles.eyebrow}>{item.n}</span><h3>{item.title}</h3><p>{item.body}</p><p className={styles.detail}>{item.detail}</p></article>)}</div>
          <div className={styles.repairs}>
            <h3>What changed in Blender.</h3>
            <dl>
              <div><dt>A controlled chocolate merge</dt><dd>The original spread surface folded through itself. Twenty baked meshes now define the transition frame by frame, with the opening filled by frame 100.</dd></div>
              <div><dt>A readable centre</dt><dd>The macro piece was rebuilt as a rounded cut shell with a separate recessed filling. Corrected fork contact keeps the support and product together.</dd></div>
              <div><dt>Colour and lettering that hold</dt><dd>Reduced product lighting preserves the three package colours. Camera-space title and tagline artwork keep those words stable through the edit.</dd></div>
            </dl>
          </div>
          <figure className={styles.contactSheet}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={VELUNE_MEDIA.contactSheet} width={1280} height={1632} alt="Thirty representative poses from the actual VELUNE Blender camera study, including the question-mark assembly, observer arcs and studio pullback" loading="lazy" />
            <figcaption>Camera-study contact sheet · Actual Blender frames <a href={VELUNE_MEDIA.contactSheet} target="_blank" rel="noreferrer">Open full image ↗</a></figcaption>
          </figure>
        </section>

        <section className={styles.referenceSection} id="visual-references" aria-labelledby="references-heading">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div><p className={styles.eyebrow}>03 / Appearance direction</p><h2 id="references-heading">References shape<br /><em>the direction.</em></h2></div>
              <div className={styles.referenceIntro}><span className={styles.referenceStatus}>9 reference images · Revision 2</span><p>Nine new stills. These are the exact images loaded by the revised H3 example, numbered to match their upload slots. The collage, old cast portraits and two older chocolate studies are excluded from this take.</p></div>
            </div>
            <div className={styles.referenceActions}><Link className={styles.cta} href="/ai-studio/ads">Try this direction in Ad Lab <span aria-hidden>↗</span></Link><a className={styles.referenceJump} href="/studio/velune/velune_h3_v2_pack.zip" download>Download the named images & H3 prompt <span aria-hidden>↓</span></a><p>In Ad Lab, choose “Load VELUNE example”. H3 Max · 15s · 16:9 · 768p · 9 images + 1 Blender guide.</p></div>
            <div className={styles.referenceProvenance}>
              <p><strong>Appearance</strong>Supplied AI reference images</p>
              <p><strong>Movement</strong>Original Blender camera layouts</p>
              <p><strong>Lettering</strong>Separate report master & final type check</p>
            </div>
            {REFERENCE_GROUPS.map((group) => (
              <div className={styles.referenceGroup} key={group.id}>
                <div className={styles.referenceGroupHead}><h3>{group.title}</h3><p>{group.note}</p></div>
                <div className={`${styles.referenceGrid} ${group.columns === 3 ? styles.productReferenceGrid : ""}`}>
                  {VELUNE_REFERENCES.filter((reference) => (group.indices as readonly number[]).includes(reference.index)).map((reference) => (
                    <figure className={styles.referenceCard} key={reference.id}>
                      <a className={styles.referenceImage} href={reference.url} target="_blank" rel="noreferrer" aria-label={`Open ${reference.title} reference image in a new tab`}>
                        <Image src={reference.url} width={reference.width} height={reference.height} alt={`Supplied AI-generated VELUNE reference: ${reference.title}`} sizes={group.columns === 3 ? "(max-width: 600px) calc(100vw - 44px), (max-width: 1000px) calc((100vw - 80px) / 2), 300px" : "(max-width: 600px) calc(100vw - 44px), (max-width: 1000px) calc((100vw - 80px) / 2), 620px"} />
                        <span className={styles.referenceOpen} aria-hidden="true">View image ↗</span>
                      </a>
                      <figcaption>
                        <span className={styles.referenceIndex}>Reference {String(reference.index).padStart(2, "0")}</span>
                        <h4>{reference.title}</h4>
                        <p>{reference.role}</p>
                        <span className={styles.referenceShots}>Shot direction · {reference.shotIds.join(" / ")}</span><a className={styles.referenceDownload} href={reference.url} download={reference.fileName}>Download JPEG ↗</a>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            ))}
            <p className={styles.referenceFootnote}>Fictional AI-generated appearance studies. They define the intended look, not proof of the resulting motion. Loading the example creates a new working copy; earlier drafts and completed takes remain available.</p>
          </div>
        </section>

        <section className={styles.artSection} aria-labelledby="art-heading">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>04 / The original artwork</p><h2 id="art-heading">Three centres.<br /><em>One family.</em></h2></div><p>Pistachio Praline, Raspberry Ganache and Salted Caramel share one chocolate shell. These original flat designs establish the lettering and colour system beneath the appearance references.</p></div>
            <figure className={styles.packaging}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={VELUNE_MEDIA.packaging} width={1440} height={904} alt="Three flat VELUNE package fronts: Pistachio Praline, Raspberry Ganache and Salted Caramel" loading="lazy" />
              <figcaption>Original flat concept artwork · Package lettering and illustrations, separate from the AI-generated appearance studies above.</figcaption>
            </figure>
            <div className={styles.reportRow}>
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/studio/velune/finishing/velune_centre_report_v2.svg" width={1920} height={1080} alt="Revised Centre Report with individual VELUNE carton photographs above the three exposed chocolate centres" loading="lazy" />
                <figcaption>The Centre Report · Revision 2 finishing artwork</figcaption>
              </figure>
              <div><p className={styles.eyebrow}>The protected reading moment</p><h3>One printed surface.<br />Three full seconds.</h3><p>The revised report pairs the three dimensional carton photographs with the exposed centres. Exact headings stay in this separate graphic, ready to composite over the three-second report shot after generation. It does not use an extra H3 reference slot.</p><a className={styles.referenceJump} href="/studio/velune/finishing/velune_centre_report_v2.svg" download>Download the report master ↓</a></div>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="workflow-heading">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>05 / Production in the open</p><h2 id="workflow-heading">The route to the final film.</h2></div><p>The original guide and revised appearance pack are ready. The first H3 take prompted a clearer brief; the next take and final mix will be reviewed before becoming the published film.</p></div>
          <ol className={styles.stages}>{STAGES.map((stage) => <li key={stage.n}><span className={styles.stageNumber}>{stage.n}</span><div><span className={styles.stageState}>{stage.state}</span><h3>{stage.title}</h3><p>{stage.body}</p></div></li>)}</ol>
        </section>

        <section className={styles.soundSection} aria-labelledby="sound-heading">
          <div className={`${styles.wrap} ${styles.soundGrid}`}>
            <div><p className={styles.eyebrow}>06 / Sound direction · Proposed</p><h2 id="sound-heading">A little curiosity.<br /><em>Room to listen.</em></h2><p>Four short voice lines leave space for the visual reveals. The proposed 80 BPM score moves from a sparse, warm motif to a gentle expansion, then thins for the report and final line.</p><p>The example loads the voice lines, music brief and effect cues separately. Check any existing audio takes against the accepted picture before placing accents and ducking the music in the final edit.</p><Link className={styles.cta} href="/ai-studio/ads#ad-sound">Explore the sound workflow <span aria-hidden>↗</span></Link></div>
            <div className={styles.voice}><p className={styles.eyebrow}>Proposed voice windows / seconds</p>{VOICE.map((line) => <div key={line.window}><span>{line.window}</span><blockquote>“{line.text}”</blockquote></div>)}<p className={styles.pronunciation}>VELUNE is pronounced veh-LOON. Each take will be auditioned against its available time.</p></div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.credits}`}>
          <div><p className={styles.eyebrow}>Direction & process</p><h2>Ajwad Rauf</h2><p>Creative direction and production review, with AI assistance for the brief and technical build. Nine selected AI-generated images guide the revised appearance. Blender supplies the unchanged camera study; H3 Max produces the picture, with ElevenLabs voice, music and effects prepared for the final edit.</p></div>
          <div><p className={styles.eyebrow}>Study notes</p><p>VELUNE is an independent fictional concept, not a commissioned campaign. No client results or finished commercial are claimed. Original source footage, performer identities and soundtrack are not included on this page.</p><Link href="/#ar-work">Back to selected work <span aria-hidden>↗</span></Link></div>
        </section>
      </main>
      <footer className={`${styles.wrap} ${styles.footer}`}><span>Ajwad Rauf · Toronto · 2026</span><a href="mailto:hello@ajwadrauf.com">hello@ajwadrauf.com ↗</a></footer>
    </div>
  );
}
