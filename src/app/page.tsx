import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { HomeNav } from "@/components/HomeNav";
import { SmoothAnchors } from "@/components/home/SmoothAnchors";
import { VELUNE_MOTION } from "@/components/velune/veluneStudy";
import "@/components/home/home.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ajwad Rauf · Creative direction, generative AI and production leadership",
  description: "Ajwad Rauf leads marketing production at Loblaw and directs independent AI-assisted work. Explore VELUNE, AI Content Studio, PersoPot and Project Forge.",
  alternates: { canonical: "https://www.ajwadrauf.com/" },
  openGraph: {
    images: [{ url: "https://www.ajwadrauf.com/homepage/velune-hero.webp", width: 1440, height: 810, alt: "Three filled VELUNE chocolates revealed on a ceramic plate" }],
  },
};

const METHOD = [
  { title: "Brief the idea", body: "Agree on what the audience should notice, feel or do. Give each reference a job before building the first frame." },
  { title: "Review the work", body: "Compare against the brief at full size. Check the product, the copy and the decisions that still need a person." },
  { title: "Make the handoff clear", body: "Keep the approved artwork, review notes and editable files together so a teammate can make the next version." },
] as const;

export default function Home() {
  return (
    <div id="ajwad-home" className={instrumentSerif.variable}>
      <SmoothAnchors />
      <a className="ar-skip" href="#ar-main">Skip to content</a>
      <HomeNav />

      <main id="ar-main" tabIndex={-1}>
        <section className="ar-hero ar-wrap" id="ar-top" aria-labelledby="ar-hero-heading">
          <div className="ar-hero-copy">
            <p className="ar-kicker">Creative direction &amp; production leadership</p>
            <h1 id="ar-hero-heading">The idea leads.<br /><em>The technology follows.</em></h1>
            <p className="ar-lead">I direct AI-assisted campaigns and build the production workflows that help teams take a brief through to finished work.</p>
            <p className="ar-affiliation">Marketing production at Loblaw <span aria-hidden>·</span> Toronto</p>
            <div className="ar-actions">
              <a className="ar-primary" href="#ar-work">Explore selected work <span aria-hidden>↓</span></a>
              <Link className="ar-link" href="/velune#velune-film">Watch VELUNE <span aria-hidden>↗</span></Link>
            </div>
          </div>
          <figure className="ar-hero-visual">
            <Link href="/velune" aria-label="Explore the VELUNE campaign">
              <Image src="/homepage/velune-hero.webp" width={1440} height={810} alt="Pistachio, raspberry and caramel chocolate centres on a cream plate against a burgundy set" sizes="(max-width: 760px) 94vw, (max-width: 1300px) 56vw, 715px" preload />
            </Link>
            <figcaption><strong>VELUNE</strong><span>Frame from the finished film</span></figcaption>
          </figure>
        </section>

        <section className="ar-campaign" id="ar-work" aria-labelledby="ar-work-heading">
          <div className="ar-wrap ar-campaign-grid">
            <div className="ar-campaign-copy">
              <p className="ar-kicker">Selected work / Independent campaign</p>
              <h2 id="ar-work-heading">VELUNE <em>Wonder within.</em></h2>
              <p className="ar-lead">A fictional chocolate brand and a 15-second film that makes the first look inside feel like a discovery.</p>
              <p>I directed the reveal, camera rhythm and product references, then reviewed the generated shots for packaging, pacing and legibility. The campaign extends into social, bilingual imagery and editable motion.</p>
              <div className="ar-campaign-links">
                <Link className="ar-primary" href="/velune">Explore the VELUNE campaign <span aria-hidden>↗</span></Link>
                <Link className="ar-link" href="/velune#camera-study">Shot-by-shot decisions <span aria-hidden>↗</span></Link>
                <Link className="ar-link" href="/velune/treatment">Creative treatment <span aria-hidden>↗</span></Link>
              </div>
            </div>
            <figure className="ar-video">
              <video width={960} height={540} controls muted playsInline preload="none" poster="/homepage/velune-preview.webp" aria-label="Six-second silent preview of the VELUNE campaign">
                <source src="/homepage/velune-preview.mp4" type="video/mp4" />
                <a href="/homepage/velune-preview.mp4">Open the VELUNE preview</a>
              </video>
              <figcaption>Campaign excerpt <span>06 sec / silent</span></figcaption>
            </figure>
          </div>
        </section>

        <section className="ar-wrap ar-studio" aria-labelledby="ar-studio-heading">
          <div className="ar-studio-copy">
            <p className="ar-kicker">Creative production</p>
            <h2 id="ar-studio-heading">AI Content Studio</h2>
            <p>A toolkit I built for product imagery, campaign layouts, video and sound. It connects references and briefs to model choice and creative review so a team can carry a concept across formats.</p>
            <Link className="ar-link" href="/ai-studio">Explore AI Content Studio <span aria-hidden>↗</span></Link>
          </div>
          <article className="ar-workflow" aria-labelledby="ar-workflow-heading">
            <div className="ar-workflow-images">
              <figure>
                <Image src="/studio/velune/workflows/weave-social-detail.webp" width={380} height={419} alt="Generated VELUNE carton detail with altered chocolate artwork and brighter red packaging" sizes="(max-width: 760px) 46vw, 32vw" />
                <figcaption>Generated carton</figcaption>
              </figure>
              <figure>
                <Image src="/studio/velune/workflows/finished-social-detail.webp" width={380} height={419} alt="Finished VELUNE carton with the illustrated chocolate and label restored from the reference face" sizes="(max-width: 760px) 46vw, 32vw" />
                <figcaption>Reference face restored</figcaption>
              </figure>
            </div>
            <div className="ar-workflow-caption">
              <h3 id="ar-workflow-heading">ComfyUI × Figma Weave</h3>
              <p>Both workflows changed the artwork on the pack. I selected the lighting and restored the original carton face during finishing.</p>
              <Link className="ar-link" href="/ai-studio/workflows">Compare the carton workflows <span aria-hidden>↗</span></Link>
            </div>
          </article>
        </section>

        <section className="ar-wrap ar-range" id="ar-more-work" aria-labelledby="ar-range-heading">
          <h2 id="ar-range-heading">More work</h2>
          <div className="ar-range-grid">
            <article className="ar-range-project">
              <figure className="ar-range-preview ar-persopot">
                <video width={1120} height={728} controls muted playsInline preload="none" poster="/homepage/persopot-motion-poster.jpg" aria-label="Play the PersoPot preview" aria-describedby="ar-persopot-preview-description">
                  <source src="/homepage/persopot-motion.mp4" type="video/mp4" />
                  <a href="/homepage/persopot-motion.mp4">Open the PersoPot preview</a>
                </video>
                <figcaption id="ar-persopot-preview-description"><span>Try on, shortlist, ask a friend</span><span>12 sec · Silent</span></figcaption>
              </figure>
              <div className="ar-range-copy">
                <p className="ar-kicker">Consumer product</p>
                <h3>PersoPot</h3>
                <p>I built PersoPot to help people try outfits on their own photo, save a shortlist and ask a friend what they’d pick. The preview shows AI try-ons and sample feedback.</p>
                <a className="ar-link" href="https://persopot.com/" target="_blank" rel="noreferrer">Explore PersoPot <span aria-hidden>↗</span></a>
              </div>
            </article>
            <article className="ar-range-project">
              <figure className="ar-range-preview ar-cream">
                <video width={1120} height={728} controls muted playsInline preload="none" poster="/homepage/cream-motion-poster.jpg" aria-label="Play the Cream in Motion comparison" aria-describedby="ar-cream-preview-description">
                  <source src="/homepage/cream-motion.mp4" type="video/mp4" />
                  <a href="/homepage/cream-motion.mp4">Open the Cream in Motion comparison</a>
                </video>
                <figcaption id="ar-cream-preview-description"><span>Blender blocking, shaded render, Seedance</span><span>10 sec · Silent</span></figcaption>
              </figure>
              <div className="ar-range-copy">
                <p className="ar-kicker">Blender to film</p>
                <h3>Cream in motion</h3>
                <p>A seven-shot Blender camera plan guided an 18-second Seedance film. Watch the same two shots across blocking, shading and generation.</p>
                <Link className="ar-link" href="/ai-studio/ads/cream-in-motion">Explore the motion study <span aria-hidden>↗</span></Link>
              </div>
            </article>
          </div>
        </section>

        <section className="ar-leadership" id="ar-leadership" aria-labelledby="ar-leadership-heading">
          <div className="ar-wrap ar-leadership-grid">
            <div>
              <p className="ar-kicker">Loblaw · Marketing production</p>
              <h2 id="ar-leadership-heading">How I lead production</h2>
              <p className="ar-lead">I lead a marketing production team at Loblaw.</p>
              <p>I coach colleagues through briefing, QA and approvals, coordinate marketing and technical partners, and run working sessions on where generative AI can help and how to review its output.</p>
            </div>
            <div>
              <dl className="ar-leadership-facts">
                <div><dt>Direct reports</dt><dd>7</dd></div>
              </dl>
              <div className="ar-forge">
                <h3>Project Forge</h3>
                <p>I designed and built an internal tool to connect intake, bilingual checks, creative review and sign-off. The design gives producers and approvers a shared record of what needs to happen next.</p>
                <Link className="ar-link" href="/project-forge">Read the Project Forge case study <span aria-hidden>↗</span></Link>
              </div>
            </div>
          </div>
        </section>

        <section className="ar-wrap ar-approach" id="ar-approach" aria-labelledby="ar-approach-heading">
          <h2 id="ar-approach-heading">How I work</h2>
          <dl>
            {METHOD.map((step) => <div key={step.title}><dt>{step.title}</dt><dd>{step.body}</dd></div>)}
          </dl>
        </section>

        <section className="ar-motion" id="ar-film" aria-labelledby="ar-motion-heading">
          <div className="ar-wrap ar-motion-grid">
            <div>
              <p className="ar-kicker">Motion reel</p>
              <h2 id="ar-motion-heading">Selected motion</h2>
              <p>Excerpts from VELUNE, its editable After Effects study, the shaded Blender pass for Cream in motion, and TOKEN.</p>
              <div className="ar-motion-links">
                <Link className="ar-link" href="/velune#after-effects">After Effects project <span aria-hidden>↗</span></Link>
                <a className="ar-link" href="/homepage/token-film.mp4">Watch the full TOKEN film <span aria-hidden>↗</span></a>
              </div>
            </div>
            <figure className="ar-video">
              <video width={960} height={540} controls muted playsInline preload="none" poster={VELUNE_MOTION.collection} aria-label="Eleven-second silent reel of four motion studies">
                <source src="/homepage/motion-reel.mp4" type="video/mp4" />
                <a href="/homepage/motion-reel.mp4">Open the motion reel</a>
              </video>
              <figcaption>Four motion studies <span>11 sec / silent</span></figcaption>
            </figure>
          </div>
        </section>
      </main>

      <footer className="ar-contact ar-wrap" id="ar-contact">
        <div>
          <p className="ar-kicker">Contact</p>
          <h2>Let’s talk about the work.</h2>
        </div>
        <div className="ar-contact-links">
          <a className="ar-link" href="mailto:hello@ajwadrauf.com">hello@ajwadrauf.com <span aria-hidden>↗</span></a>
          <a className="ar-link" href="https://www.linkedin.com/in/ajwadrauf" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden>↗</span></a>
          <a className="ar-link" href="#ar-top">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
