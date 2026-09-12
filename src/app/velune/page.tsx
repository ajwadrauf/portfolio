import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SoundtrackPreview } from "@/components/ad/SoundtrackPreview";
import { VELUNE_PACKAGE_PANELS } from "@/lib/velunePackaging";
import { Wordmark } from "@/components/Wordmark";
import { VelunePlayer } from "@/components/velune/VelunePlayer";
import { VELUNE_MEDIA } from "@/components/velune/veluneStudy";
import { VELUNE_REFERENCES } from "@/lib/veluneReferences";
import styles from "@/components/velune/Velune.module.css";

export const metadata: Metadata = {
  title: "VELUNE · a chocolate campaign & creative process · Ajwad Rauf",
  description: "A fictional chocolate campaign from brief to delivery: a finished film with H3 sound and ElevenLabs voiceover, campaign still, vertical social layout and English/French adaptation.",
};

const DECISIONS = [
  { n: "01", title: "Make curiosity visible.", body: "A tight, empty chocolate opening asks the question. A wider passage reveals three filled centres at the end. The revised direction gives curiosity a visible payoff.", detail: "Tight opening → discovery → three-centre reveal" },
  { n: "02", title: "Move the right thing.", body: "The macro fork stays still while soft background figures move. In the studio, a backward camera move reveals workers already tasting and gesturing. Small actions bring the setting to life.", detail: "Registered product / working gestures / real parallax" },
  { n: "03", title: "Give the eye time.", body: "Three quick carton cuts establish the flavour family. Later, The Centre Report gives the viewer a reading pause. The fastest and quietest moments have different jobs.", detail: "Quick carton cuts / A held reading moment" },
] as const;

const STAGES = [
  { n: "01", title: "Adapt the choreography", state: "Brief & artwork", body: "An existing shot structure becomes a new fictional chocolate world. Brand, product, report artwork and proposed sound are new creative; reference performers and branded footage are not reproduced here." },
  { n: "02", title: "Build the camera study", state: "Guide ready", body: "Geometry makes the timing, framing, object count and camera route reviewable. This preview is a working animatic; material quality and character performance remain provisional." },
  { n: "03", title: "Develop the appearance", state: "Appearance selected", body: "The first H3 take informed nine new images. Individual cartons, ingredient detail, working gestures and distinct bookends guided the revised take. The original Blender video stays unchanged." },
  { n: "04", title: "Audition, mix, finish", state: "Campaign files ready", body: "Selected carton artwork and the report are finished locally, with opening and closing type. H3 sound and ElevenLabs voiceover are mixed into the MP4. A still, vertical layout and English/French adaptation extend the same idea." },
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
            <a className={styles.cta} href="#camera-study">Explore the making of <span aria-hidden>↓</span></a>
            <a className={styles.referenceJump} href="#visual-references">Explore the appearance references <span aria-hidden="true">↓</span></a>
          </div>
          <aside className={styles.heroNote}>
            <span className={styles.status}>Film · Campaign stills · Social layout</span>
            <p>Follow the camera plan, visual direction and finishing decisions. The complete campaign set, including the film with its mixed soundtrack, comes together at the end.</p>
            <dl><div><dt>Format</dt><dd>15 seconds / 16:9</dd></div><div><dt>Edit target</dt><dd>360 frames / 24 fps</dd></div><div><dt>Structure</dt><dd>12 shots / 11 hard cuts</dd></div><div><dt>Project</dt><dd>Independent concept</dd></div></dl>
          </aside>
        </section>

        <section className={`${styles.wrap} ${styles.campaignBrief}`} aria-label="Campaign brief">
          <div><p className={styles.eyebrow}>The brief</p><h2>A world in one bite.</h2></div>
          <dl><div><dt>Audience</dt><dd>Adults drawn to distinctive chocolate and small moments of indulgence.</dd></div><div><dt>Objective</dt><dd>Introduce VELUNE and make its three filled centres memorable.</dd></div><div><dt>Delivery</dt><dd>A film with embedded sound, campaign still, vertical social layout and English/French still.</dd></div></dl>
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
          <div className={styles.judgment} id="creative-review">
            <div className={styles.judgmentHeading}><p className={styles.eyebrow}>A decision you can see</p><h3>The camera plan was useful.<br />The proxy artwork was getting through.</h3><p>The generated take briefly returned to flat Blender carton artwork. I kept the sequence, then replaced the three short carton inserts with the selected appearance images during local finishing.</p></div>
            <div className={styles.comparisonGrid}>
              <figure><Image src="/studio/velune/delivery/carton-before.jpg" width={1344} height={768} alt="Source H3 frame at 2.375 seconds: the raspberry carton has flat proxy artwork" sizes="(max-width: 760px) 90vw, 45vw" /><figcaption><strong>Before · H3 source take</strong><span>At 2.375s, the flat shield graphic replaces the intended chocolate photograph.</span></figcaption></figure>
              <figure><Image src="/studio/velune/delivery/carton-after.jpg" width={1920} height={1080} alt="Finished frame at 2.375 seconds: selected raspberry carton artwork shows the whole bonbon and exposed filling" sizes="(max-width: 760px) 90vw, 45vw" /><figcaption><strong>After · Local finishing</strong><span>The selected cover restores paper texture, carton depth and the visible raspberry centre.</span></figcaption></figure>
            </div>
            <p className={styles.judgmentNote}>Both images show the same moment. The improvement shown here is an editorial replacement, with the model-generated source preserved for comparison.</p>
          </div>
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
              <div className={styles.referenceIntro}><span className={styles.referenceStatus}>9 selected reference images</span><p>These nine selected images guide the H3 example, numbered to match their upload slots. Each has a clear job: carton appearance, ingredient detail, working gestures or the opening and closing composition.</p></div>
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
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>04 / Package design</p><h2 id="art-heading">Three centres.<br /><em>One family.</em></h2></div><p>Pistachio Praline, Raspberry Ganache and Salted Caramel share one chocolate shell. The revised pistachio cover joins the supplied back, top, bottom and side views. Together, these six image references complete the concept carton in the packshot example.</p></div>
            <div className={styles.panelGallery}>{VELUNE_PACKAGE_PANELS.map((panel) => <figure key={panel.face}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={panel.url} alt={`VELUNE pistachio carton reference: ${panel.face} panel`} loading="lazy" />
              <figcaption><strong>{panel.label}</strong><a href={panel.url} download>Download reference ↓</a></figcaption>
            </figure>)}</div>
            <Link className={styles.referenceJump} href="/ai-studio/packshots">Explore the six-face packshot example ↗</Link>
            <p className={styles.mediaNote}>In Packshots, load the VELUNE example, open Artwork & dielines, then choose “Load VELUNE carton artwork”. The studio maps cropped photo references to all six faces, including the product story and information on the back.</p>
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
              <div><p className={styles.eyebrow}>The protected reading moment</p><h3>One printed surface.<br />Room to read.</h3><p>The revised report pairs the three dimensional carton photographs with the exposed centres. The final film uses this typeset graphic for its reading moment, replacing the generated report. It does not use an extra H3 reference slot.</p><a className={styles.referenceJump} href="/studio/velune/finishing/velune_centre_report_v2.svg" download>Download the report master ↓</a></div>
            </div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.section}`} aria-labelledby="workflow-heading">
          <div className={styles.sectionHead}><div><p className={styles.eyebrow}>05 / Production in the open</p><h2 id="workflow-heading">The route to the final film.</h2></div><p>The camera guide establishes the sequence. Appearance references shape the generated take. Local finishing brings the picture, typography and sound into files that can be watched and shared.</p></div>
          <ol className={styles.stages}>{STAGES.map((stage) => <li key={stage.n}><span className={styles.stageNumber}>{stage.n}</span><div><span className={styles.stageState}>{stage.state}</span><h3>{stage.title}</h3><p>{stage.body}</p></div></li>)}</ol>
        </section>

        <section className={styles.soundSection} aria-labelledby="sound-heading">
          <div className={`${styles.wrap} ${styles.soundGrid}`}>
            <div><p className={styles.eyebrow}>06 / Sound direction</p><h2 id="sound-heading">A little curiosity.<br /><em>Room to listen.</em></h2><p>Four short voice lines leave space for the visual reveals. The final mix combines the supplied ElevenLabs voice with H3’s original sound, lowering the background during speech and letting the final sound settle at the cut.</p><p>Ad Lab keeps voice, the optional music brief and effect cues available separately. The campaign MP4 below already contains the selected mix; the original layers remain available for comparison.</p><Link className={styles.cta} href="/ai-studio/ads#ad-sound">Explore the sound workflow <span aria-hidden>↗</span></Link></div>
            <div className={styles.voice}><p className={styles.eyebrow}>Proposed voice windows / seconds</p>{VOICE.map((line) => <div key={line.window}><span>{line.window}</span><blockquote>“{line.text}”</blockquote></div>)}<p className={styles.pronunciation}>VELUNE is pronounced veh-LOON. These are the planned narration windows. The delivered film uses the supplied voiceover recording, with its existing timing.</p></div>
          </div>
        </section>

        <section className={`${styles.wrap} ${styles.credits}`}>
          <div><p className={styles.eyebrow}>My role</p><h2>Ajwad Rauf</h2><p>Concept adaptation, creative direction, reference selection and production review. I identified where the picture lost credibility and chose what needed to change. AI assisted the brief, code, imagery and local finishing. Blender supplied the camera study, H3 Max the generated picture and native sound, and ElevenLabs the voiceover.</p></div>
          <div><p className={styles.eyebrow}>Study notes</p><p>An independent fictional campaign concept. The final files bring together the selected imagery, typeset graphics and mixed sound. This is portfolio work, with no client performance results attached. Source files remain available below.</p><Link href="/#ar-work">Back to selected work <span aria-hidden>↗</span></Link></div>
        </section>
        <section className={styles.cinema} id="velune-film" aria-labelledby="film-heading">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}><div><p className={styles.eyebrow}>07 / Campaign delivery</p><h2 id="film-heading">Wonder within.<br /><em>The work comes together.</em></h2></div><p>A finished 15-second MP4 with opening and closing typography, corrected carton inserts, the typeset report and H3 sound mixed with ElevenLabs voiceover.</p></div>
            <video className={styles.finalVideo} src={VELUNE_MEDIA.finalFilm} poster={VELUNE_MEDIA.finalPoster} controls playsInline preload="metadata" aria-label="VELUNE finished fifteen-second campaign film with mixed sound">Your browser does not support video. Download the final MP4 below.</video>
            <div className={styles.filmDownloads}><a href={VELUNE_MEDIA.finalFilm} download>Download final MP4 ↘</a><a href={VELUNE_MEDIA.deliveryBundle} download>Download campaign set ↘</a><a href={VELUNE_MEDIA.finalMix} download>Download mixed WAV ↘</a></div>
            <p className={styles.deliveryNote}>1920 × 1080 · 24 fps · 15 seconds · Stereo sound. Finished from the supplied 768p H3 take.</p>
            <div className={styles.adaptations} aria-label="Campaign adaptations">
              <figure><div className={styles.adaptationMedia}><a href={VELUNE_MEDIA.campaignStill} target="_blank" rel="noreferrer"><Image src={VELUNE_MEDIA.campaignStill} width={1920} height={1080} alt="VELUNE campaign still with the three filled chocolates and Wonder within headline" sizes="(max-width: 760px) 90vw, 33vw" /></a></div><figcaption><span className={styles.eyebrow}>Campaign still · 16:9</span><h3>A single reveal.</h3><p>The product sits at left, with the brand and headline in the quieter space at right.</p><a href={VELUNE_MEDIA.campaignStill} download>Download 1920 × 1080 PNG ↓</a></figcaption></figure>
              <figure><div className={styles.adaptationMedia}><video src={VELUNE_MEDIA.verticalFilm} poster={VELUNE_MEDIA.verticalPoster} controls playsInline preload="none" aria-label="VELUNE vertical social layout with embedded sound" /></div><figcaption><span className={styles.eyebrow}>Vertical social layout · 9:16</span><h3>Give the film a new frame.</h3><p>A portrait layout keeps the complete film visible, with larger brand and headline type around it.</p><a href={VELUNE_MEDIA.verticalFilm} download>Download 1080 × 1920 MP4 ↓</a></figcaption></figure>
              <figure><div className={styles.adaptationMedia}><a href={VELUNE_MEDIA.bilingualStill} target="_blank" rel="noreferrer"><Image src={VELUNE_MEDIA.bilingualStill} width={1080} height={1350} alt="Bilingual VELUNE still with Wonder within and Un monde à découvrir beneath the three filled chocolates" sizes="(max-width: 760px) 90vw, 33vw" /></a></div><figcaption><span className={styles.eyebrow}>English / French still · 4:5</span><h3>Carry the idea across.</h3><p>“Un monde à découvrir.” adapts the discovery idea. Both languages have equal space and visual weight.</p><a href={VELUNE_MEDIA.bilingualStill} download>Download 1080 × 1350 PNG ↓</a></figcaption></figure>
            </div>
            <details className={styles.sourceCompare}><summary>Compare original sound and voiceover</summary><p>This comparison uses the original H3 take. Its sound switch affects playback here; the final MP4 above already includes the selected mix and picture finishing.</p><SoundtrackPreview soundtrackUrl={VELUNE_MEDIA.voiceover} videoUrl={VELUNE_MEDIA.film} originalAudioAvailable context="showcase" initialOriginal /><div className={styles.filmDownloads}><a href={VELUNE_MEDIA.film} download>Original H3 take ↓</a><a href={VELUNE_MEDIA.voiceover} download>Original voiceover WAV ↓</a><a href="/studio/velune/delivery/delivery-manifest.json" download>File specifications & finishing notes ↓</a></div></details>
            <a className={styles.deliveryBack} href="#camera-study">Revisit the Blender guide ↑</a>
          </div>
        </section>

      </main>
      <footer className={`${styles.wrap} ${styles.footer}`}><span>Ajwad Rauf · Toronto · 2026</span><a href="mailto:hello@ajwadrauf.com">hello@ajwadrauf.com ↗</a></footer>
    </div>
  );
}
