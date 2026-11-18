import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { VELUNE_MEDIA, VELUNE_MOTION } from "@/components/velune/veluneStudy";
import styles from "./treatment.module.css";

const reference = "/studio/velune/references/v2";

export const metadata: Metadata = {
  title: "VELUNE · Creative treatment · Ajwad Rauf",
  description: "A presentation of the VELUNE campaign brief, two creative directions, the visual system, the proposed rollout and the review decisions.",
  alternates: { canonical: "https://www.ajwadrauf.com/velune/treatment" },
  openGraph: { images: [{ url: `https://www.ajwadrauf.com${VELUNE_MEDIA.campaignStill}`, width: 1920, height: 1080, alt: "VELUNE campaign still with three filled chocolates and the Wonder within line" }] },
};

const formats = [
  { title: "Launch with the 15-second film", image: VELUNE_MEDIA.finalPoster, width: 1920, height: 1080, alt: "VELUNE film end frame with the three filled chocolates", note: "Use the wide film to establish the world, build the question and reveal all three centres.", href: "/velune#velune-film", link: "Watch the finished film" },
  { title: "Adapt for vertical social", image: VELUNE_MEDIA.verticalPoster, width: 1080, height: 1920, alt: "Vertical VELUNE layout with the film framed by the brand and headline", note: "Keep the product and line large enough to read on a phone. Review the ending with sound off and check the placement’s safe areas.", href: VELUNE_MEDIA.verticalFilm, link: "Open the vertical adaptation" },
  { title: "Version English and French", image: VELUNE_MEDIA.bilingualStill, width: 1080, height: 1350, alt: "Bilingual VELUNE still with the lines Wonder within and Un monde à découvrir", note: "Carry the discovery idea into French with equal visual weight, then proof the wording and spacing in the final layout.", href: VELUNE_MEDIA.bilingualStill, link: "Open the bilingual still" },
] as const;

const checks = [
  { label: "Creative and brand", question: "Does the opening earn the reveal?", evidence: "Play the cut once at full speed. Decide whether the viewer gets the idea and remembers what makes this chocolate distinctive." },
  { label: "Packaging and finishing", question: "What drifted in generation?", evidence: "Review the carton front, side and lettering against the reference at full size. Fix the artwork and log the correction before versioning." },
  { label: "Social and language", question: "Does the idea survive a change of format?", evidence: "Review the first frame and end card on a phone, check the cut without sound, and proof English and French in context." },
] as const;

export default function VeluneTreatment() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#treatment-main">Skip to treatment</a>
      <header className={`${styles.wrap} ${styles.nav}`}>
        <Link href="/" aria-label="Ajwad Rauf, homepage"><Wordmark size="md" /></Link>
        <nav aria-label="Treatment navigation"><Link href="/velune">← VELUNE case study</Link><Link href="/#ar-work">Selected work ↗</Link></nav>
      </header>
      <main id="treatment-main" tabIndex={-1}>
        <section className={styles.cover} aria-labelledby="treatment-title">
          <div className={`${styles.wrap} ${styles.coverGrid}`}>
            <div>
              <p className={styles.label}>VELUNE / Creative treatment</p>
              <h1 id="treatment-title">Wonder<br /><em>within.</em></h1>
              <p className={styles.intro}>Introduce three filled chocolates through one small moment of discovery.</p>
              <p className={styles.byline}>Independent campaign concept · Ajwad Rauf</p>
              <nav aria-label="Treatment chapters">
                <a href="#creative-routes">Creative directions</a>
                <a href="#campaign-rollout">Rollout</a>
                <a href="#review-plan">Review plan</a>
              </nav>
            </div>
            <figure>
              <Image src={VELUNE_MEDIA.campaignStill} width={1920} height={1080} alt="Three filled chocolates on a plate inside a chocolate passage beside the line Wonder within" sizes="(max-width: 830px) 95vw, 780px" preload />
              <figcaption>Finished campaign still</figcaption>
            </figure>
          </div>
        </section>

        <div className={styles.wrap}>
          <section className={styles.section} aria-labelledby="brief-title">
            <h2 id="brief-title">The brief</h2>
            <dl className={styles.brief}>
              <div><dt>Audience</dt><dd>Adults who are drawn to distinctive chocolate and occasional small indulgences.</dd></div>
              <div><dt>Objective</dt><dd>Make VELUNE and its three filled centres easy to remember after a 15-second introduction.</dd></div>
              <div><dt>Creative idea</dt><dd>Hold the answer back. Start inside the chocolate world and let the revealed centres resolve the question.</dd></div>
            </dl>
          </section>

          <section className={styles.section} id="creative-routes" aria-labelledby="routes-title">
            <div className={styles.sectionHead}>
              <h2 id="routes-title">Two creative directions</h2>
              <p>The choice was where to spend the first seconds: on the mystery inside the chocolate or on the range itself.</p>
            </div>
            <div className={styles.options}>
              <article>
                <Image src={`${reference}/10_velune_opening_chocolate.jpeg`} width={1672} height={941} alt="Tight opening reference with glossy chocolate folds framing an empty passage" sizes="(max-width: 760px) 95vw, 570px" />
                <p className={styles.label}>Direction used in the film · Opening reference</p>
                <h3>Wonder within</h3>
                <p>Open tight on an empty chocolate passage and hold back the serving. Short glimpses of cartons and ingredients lead to a wide reveal of all three centres.</p>
              </article>
              <article>
                <Image src={VELUNE_MOTION.collection} width={960} height={540} alt="Green, raspberry and amber VELUNE cartons arranged together in the After Effects study" sizes="(max-width: 760px) 95vw, 570px" />
                <p className={styles.label}>Alternative direction · Motion-study frame</p>
                <h3>The Filled Collection</h3>
                <p>Lead with the three cartons and the flavour names. Use a cutaway of each centre to make the range immediately legible in retail or a fast placement.</p>
              </article>
            </div>
            <p className={styles.decision}><strong>Recommendation</strong> Use the reveal for the launch film. Use the collection-first approach where shoppers have less time and need to distinguish flavours quickly.</p>
            <Link className={styles.link} href="/velune#camera-study">See the shot-by-shot camera plan ↗</Link>
          </section>

          <section className={styles.section} aria-labelledby="identity-title">
            <div className={styles.sectionHead}>
              <h2 id="identity-title">Visual system</h2>
              <p>A dark chocolate world and a cream type palette let the three fillings provide the strongest colour cues.</p>
            </div>
            <ul className={styles.palette} aria-label="Colours sampled to represent the VELUNE visual direction">
              <li className={styles.cocoa}>Cocoa</li><li className={styles.cream}>Cream</li><li className={styles.pistachio}>Pistachio</li><li className={styles.raspberry}>Raspberry</li><li className={styles.caramel}>Caramel</li>
            </ul>
            <dl className={styles.brief}>
              <div><dt>Typography</dt><dd>Serif wordmark and headline, with quieter supporting type. Keep the end line and bilingual copy editable in finishing.</dd></div>
              <div><dt>Product</dt><dd>Keep carton proportions and flavour artwork consistent. Let the cut chocolate, paper grain and ingredients establish texture.</dd></div>
              <div><dt>Motion</dt><dd>Keep the opening tight and the final reveal wide. Use quick carton cuts and hold the report long enough to read.</dd></div>
            </dl>
            <Link className={styles.link} href="/ai-studio/workflows">See the packaging review and correction ↗</Link>
          </section>

          <section className={styles.section} id="campaign-rollout" aria-labelledby="rollout-title">
            <div className={styles.sectionHead}>
              <h2 id="rollout-title">Proposed campaign rollout</h2>
              <p>The finished portfolio assets show how the same idea can be adapted for these placements.</p>
            </div>
            <ol className={styles.formats}>
              {formats.map((item) => (
                <li key={item.title}>
                  <div className={styles.formatImage}><Image src={item.image} width={item.width} height={item.height} alt={item.alt} sizes="(max-width: 740px) 90vw, 360px" /></div>
                  <h3>{item.title}</h3>
                  <p>{item.note}</p>
                  <a className={styles.link} href={item.href}>{item.link} ↗</a>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${styles.section} ${styles.review}`} id="review-plan" aria-labelledby="review-title">
            <div className={styles.sectionHead}>
              <h2 id="review-title">How I’d lead the review</h2>
              <p>I’d open with the film, ask the group to choose what should carry across formats, and close by assigning each remaining proof to an owner.</p>
            </div>
            <dl>
              {checks.map((item) => (
                <div key={item.label}>
                  <dt><span>{item.label}</span><strong>{item.question}</strong></dt>
                  <dd>{item.evidence}</dd>
                </div>
              ))}
            </dl>
            <Link className={styles.link} href="/velune#creative-review">Inspect the corrected film frame ↗</Link>
          </section>
        </div>
      </main>
      <footer className={`${styles.wrap} ${styles.footer}`}>
        <Link href="/velune">← Back to VELUNE</Link>
        <span>Ajwad Rauf · Independent campaign concept</span>
      </footer>
    </div>
  );
}
