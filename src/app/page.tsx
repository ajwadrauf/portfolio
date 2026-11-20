import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { HomeNav } from "@/components/HomeNav";
import { HomeCampaignGraph } from "@/components/home/HomeCampaignGraph";
import { SmoothAnchors } from "@/components/home/SmoothAnchors";
import { ViewportPreview } from "@/components/home/ViewportPreview";
import { VELUNE_MEDIA, VELUNE_MOTION } from "@/components/velune/veluneStudy";
import { WORKROOM_TOOLS } from "@/lib/workroom";
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
  description: "Ajwad Rauf leads marketing production at Loblaw and directs independent AI-assisted work. Explore VELUNE, The Workroom, PersoPot and Project Forge.",
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

const PROJECT_INDEX = [
  { id: "workroom", name: "The Workroom", field: "AI-powered creative workspace", href: "#ar-studio", image: "/homepage/studio-packshot.jpg", sizes: "(max-width: 560px) 52vw, (max-width: 850px) 60vw, 36vw" },
  { id: "velune", name: "VELUNE", field: "Campaign direction & motion", href: "#ar-work", image: "/homepage/velune-hero.webp", sizes: "(max-width: 560px) 90vw, (max-width: 850px) 69vw, 40vw" },
  { id: "persopot", name: "PersoPot", field: "Try-on & shared shortlist", href: "#ar-persopot", image: "/homepage/persopot-motion-poster.jpg", sizes: "(max-width: 560px) 44vw, (max-width: 850px) 33vw, 19vw" },
] as const;

const VELUNE_ARTIFACTS = [
  { label: "Six-sided carton", href: "/velune#package-design", image: "/studio/velune/references/v2/01_velune_pistachio_carton.jpeg", width: 1672, height: 941, alt: "VELUNE Pistachio Praline carton" },
  { label: "12-shot camera plan", href: "/velune#camera-study", image: VELUNE_MEDIA.poster, width: 1920, height: 1080, alt: "Frame from the VELUNE Blender animatic" },
  { label: "Social & bilingual", href: "/velune#campaign-formats", image: VELUNE_MEDIA.bilingualStill, width: 1080, height: 1350, alt: "English and French VELUNE campaign layout" },
] as const;

export default function Home() {
  return (
    <div id="ajwad-home" className={instrumentSerif.variable}>
      <SmoothAnchors />
      <a className="ar-skip" href="#ar-main">Skip to content</a>
      <HomeNav />

      <main id="ar-main" tabIndex={-1}>
        <section className="ar-opening" id="ar-top" aria-labelledby="ar-hero-heading">
          <div className="ar-hero ar-wrap">
            <div className="ar-hero-copy">
              <p className="ar-kicker">Creative direction &amp; production leadership</p>
              <h1 id="ar-hero-heading">The idea leads.<br /><em>The technology follows.</em></h1>
              <p className="ar-lead">I direct campaigns, build creative tools and lead the teams that bring the work to life.</p>
              <p className="ar-affiliation">Marketing production at Loblaw <span aria-hidden>·</span> Toronto</p>
              <div className="ar-actions">
                <a className="ar-primary" href="#ar-work">Explore selected work <span aria-hidden>↓</span></a>
                <Link className="ar-link" href="/ai-studio">Open The Workroom <span aria-hidden>↗</span></Link>
              </div>
            </div>
            <nav className="ar-stage" aria-label="Featured projects">
              <ul>
                {PROJECT_INDEX.map((project) => (
                  <li key={project.id} className={`ar-stage-project ar-stage-${project.id}`}>
                    <a href={project.href}>
                      <Image src={project.image} fill alt="" sizes={project.sizes} loading="eager" />
                      <span className="ar-stage-caption"><span>{project.field}</span><strong>{project.name} <span aria-hidden>↓</span></strong></span>
                    </a>
                  </li>
                ))}
              </ul>
              <span className="ar-stage-glass" aria-hidden />
            </nav>
          </div>
        </section>

        <section className="ar-campaign" id="ar-work" aria-labelledby="ar-work-heading">
          <div className="ar-wrap ar-gallery-heading">
            <h2 id="ar-work-heading">Selected work</h2>
            <p>Campaigns, tools and the decisions that shaped them.</p>
          </div>
          <div className="ar-wrap ar-campaign-grid">
            <div className="ar-campaign-copy">
              <p className="ar-kicker">Independent campaign</p>
              <h3>VELUNE <em>Wonder within.</em></h3>
              <p className="ar-lead">A fictional chocolate brand and a 15-second film that makes the first look inside feel like a discovery.</p>
              <p>I directed the reveal, camera rhythm and product references, then reviewed the generated shots for packaging, pacing and legibility. The campaign extends into social, bilingual imagery and editable motion.</p>
              <div className="ar-campaign-links">
                <Link className="ar-primary" href="/velune">Explore the VELUNE campaign <span aria-hidden>↗</span></Link>
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
          <ul className="ar-wrap ar-campaign-artifacts" aria-label="Explore the VELUNE deliverables">
            {VELUNE_ARTIFACTS.map((artifact) => (
              <li key={artifact.label}>
                <Link href={artifact.href} aria-label={artifact.label}>
                  <Image src={artifact.image} width={artifact.width} height={artifact.height} alt={artifact.alt} sizes="(max-width: 560px) 108px, 150px" />
                  <span>{artifact.label} <span aria-hidden>↗</span></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="ar-wrap ar-studio" id="ar-studio" aria-labelledby="ar-studio-heading">
          <div className="ar-studio-intro">
            <div className="ar-studio-copy">
              <p className="ar-kicker">An AI-powered creative workspace</p>
              <h2 id="ar-studio-heading">The Workroom</h2>
              <p>I built The Workroom for product imagery, campaign layouts, video and sound. Start with a brief, artwork or a motion guide, then carry the work through to review.</p>
              <div className="ar-actions">
                <Link className="ar-primary" href="/ai-studio">Open The Workroom <span aria-hidden>↗</span></Link>
                <Link className="ar-link" href="/ai-studio#studio-velune-example">Try the VELUNE example <span aria-hidden>↗</span></Link>
              </div>
              <p className="ar-studio-access">Browse examples and render artwork locally in demo mode. Live AI generation requires a passcode and uses credits.</p>
            </div>
            <figure className="ar-studio-interface">
              <Link href="/ai-studio/packshots" aria-label="Open Product Shots">
                <Image src="/homepage/studio-packshot.jpg" width={1080} height={781} alt="The VELUNE carton in 3D alongside six assigned artwork faces and measurements" sizes="(max-width: 800px) 92vw, (max-width: 1360px) 53vw, 675px" />
              </Link>
              <figcaption>Product Shots <span>Live 3D carton preview</span></figcaption>
            </figure>
          </div>
          <ul className="ar-studio-tools" aria-label="Open a Workroom tool">
            {WORKROOM_TOOLS.map((tool) => (
              <li key={tool.name}>
                <Link href={tool.href}>
                  <strong>{tool.name}</strong><span className="ar-tool-arrow" aria-hidden>↗</span>
                  <span className="ar-tool-task">{tool.task}</span>
                </Link>
              </li>
            ))}
          </ul>
          <article className="ar-workflow" id="ar-velune-workflow" aria-labelledby="ar-workflow-heading">
            <div className="ar-workflow-caption">
              <p className="ar-kicker">VELUNE · Live layouts</p>
              <h3 id="ar-workflow-heading">One carton, three exports</h3>
              <p>Swap the carton flavour to update all three layouts. Change the backdrop for both social ads, then download the output you want.</p>
              <div className="ar-workflow-links">
                <Link className="ar-primary" href="/velune#campaign-assembly">Explore the workflow and replay</Link>
                <Link className="ar-link" href="/ai-studio/workflows">Compare ComfyUI and Figma Weave</Link>
              </div>
            </div>
            <HomeCampaignGraph />
          </article>
        </section>

        <section className="ar-wrap ar-range" id="ar-more-work" aria-labelledby="ar-range-heading">
          <h2 id="ar-range-heading">More work</h2>
          <div className="ar-range-grid">
            <article className="ar-range-project" id="ar-persopot">
              <figure className="ar-range-preview ar-persopot">
                <ViewportPreview src="/homepage/persopot-motion.mp4" poster="/homepage/persopot-motion-poster.jpg" label="PersoPot preview" descriptionId="ar-persopot-preview-description" />
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
                <ViewportPreview src="/homepage/cream-motion.mp4" poster="/homepage/cream-motion-poster.jpg" label="Cream in Motion comparison" descriptionId="ar-cream-preview-description" />
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
              <p className="ar-kicker">After Effects study</p>
              <h2 id="ar-motion-heading">VELUNE in motion</h2>
              <p>Animated type introduces the three flavours, then the camera moves inside the chocolate landscape for the final reveal.</p>
              <div className="ar-motion-links">
                <Link className="ar-link" href="/velune#after-effects">See the After Effects project <span aria-hidden>↗</span></Link>
              </div>
            </div>
            <figure className="ar-video">
              <video width={960} height={540} controls muted playsInline preload="none" poster={VELUNE_MOTION.collection} aria-label="VELUNE Wonder within. After Effects motion study">
                <source src={VELUNE_MOTION.film} type="video/mp4" />
                <a href={VELUNE_MOTION.film}>Open the VELUNE motion study</a>
              </video>
              <figcaption>Wonder within. <span>15 sec · Sound available</span></figcaption>
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
