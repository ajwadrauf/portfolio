import type { Metadata } from "next";
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { HomeNav } from "@/components/HomeNav";
import { SmoothAnchors } from "@/components/home/SmoothAnchors";
import { TokenFilm } from "@/components/home/TokenFilm";
import { TokenSculpture } from "@/components/home/TokenSculpture";
import { CreamFilm } from "@/components/home/CreamFilm";
import "@/components/home/home.css";

/**
 * The expressive half of the page's voice, loaded here rather than in the root
 * layout so the studio never pays for a face it does not use. It is bound to
 * <em> in home.css, which is why the variable has to reach the page root.
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ajwad Rauf — applied AI, creative work and production systems",
  description:
    "I turn emerging AI into creative work and production systems people can actually use. AI Content Studio, Persopot and Project Forge — applied AI and creative technology, from Toronto.",
};

/**
 * The three ice-cream frames.
 *
 * Appearance references behind the finished film. Keep them available as
 * process material, clearly distinguished from the generated video.
 */
const REFERENCES = [
  { src: "/homepage/macro.jpg", alt: "Close study of vanilla ice-cream texture" },
  {
    src: "/homepage/trio.jpg",
    alt: "Vanilla, chocolate and strawberry ice-cream concept reference",
  },
  { src: "/homepage/spiral.jpg", alt: "A vanilla cream ribbon spiralling around a scoop" },
] as const;

const METHOD = [
  {
    n: "01",
    h: "Explore what’s next.",
    p: "Find the capability that changes what a team can make.",
  },
  {
    n: "02",
    h: "Test what holds.",
    p: "Put fidelity, control, speed and cost against a real brief.",
  },
  {
    n: "03",
    h: "Build what lasts.",
    p: "Turn the experiment into a system someone else can run.",
  },
] as const;

export default function Home() {
  return (
    <div id="ajwad-home" className={instrumentSerif.variable}>
      <SmoothAnchors />
      <a className="ar-skip" href="#ar-main">
        Skip to content
      </a>

      <HomeNav />

      <main id="ar-main" tabIndex={-1}>
        {/* ------------------------------- Hero ------------------------------ */}
        <section className="ar-hero ar-wrap" id="ar-top">
          <div className="ar-hero-copy">
            <p className="ar-eyebrow">
              <span className="ar-dot" />
              Applied AI &amp; creative technology · Toronto
            </p>
            <h1>
              AI moves fast.
              <br />I make it <em>work.</em>
            </h1>
            <p className="ar-hero-description">
              I turn emerging AI into creative work and production systems people can
              actually use.
            </p>
            <div className="ar-hero-actions">
              <a className="ar-button ar-primary" href="#ar-work">
                Explore the work <span aria-hidden>↘</span>
              </a>
              <a className="ar-text-link" href="#ar-film">
                Watch the 12-second film <span aria-hidden>▷</span>
              </a>
            </div>
            <p className="ar-hero-footnote">From the first experiment to the last mile.</p>
          </div>
          <TokenSculpture />
        </section>

        <div className="ar-practice ar-wrap">
          <span className="ar-eyebrow">The practice</span>
          <p>
            Creative direction <span>/</span> AI production <span>/</span> Products &amp;
            systems
          </p>
          <a href="#ar-approach" aria-label="Read my approach">
            ↓
          </a>
        </div>

        {/* ------------------------------- Film ------------------------------ */}
        <section className="ar-film" id="ar-film" aria-labelledby="ar-film-heading">
          <div className="ar-wrap">
            <div className="ar-film-heading">
              <div>
                <p className="ar-eyebrow">01 / Motion study</p>
                <h2 id="ar-film-heading">
                  A thought.
                  <br />
                  <em>Made visible.</em>
                </h2>
              </div>
              <p>
                A cursor becomes a swarm. A swarm finds its form.
                <br />
                Twelve seconds of motion, built in Blender.
              </p>
            </div>
            <TokenFilm />
            <div className="ar-film-note">
              <span>Concept → choreography → Blender → final film</span>
              <span>800 tokens. One signature.</span>
            </div>
          </div>
        </section>

        {/* --------------------------- Selected work ------------------------- */}
        <section className="ar-work ar-wrap" id="ar-work" aria-labelledby="ar-work-heading">
          <div className="ar-section-heading">
            <div>
              <p className="ar-eyebrow">02 / Selected work</p>
              <h2 id="ar-work-heading">
                The work behind
                <br />
                <em>the point of view.</em>
              </h2>
            </div>
            <p>
              Creative tools, consumer products and the systems that keep production
              moving.
            </p>
          </div>

          <article className="ar-studio-project">
            <div className="ar-project-copy">
              <div className="ar-project-meta">
                <span className="ar-eyebrow">01 / AI Content Studio</span>
                <span className="ar-status">Live studio</span>
              </div>
              <h3>
                One product.
                <br />A world of possibilities.
              </h3>
              <p>
                A working toolkit for product imagery, bilingual campaigns, motion and
                sound. Built around the decisions that make AI useful: which model, which
                reference, which quality gate, and at what cost.
              </p>
              <p className="ar-film-project-note">
                See it in practice: an ice-cream film choreographed in Blender and
                brought to life with Seedance. The camera plan, the references and
                the result — all part of the work.
              </p>
              <div className="ar-tags">
                <span>Retail &amp; CPG</span>
                <span>Stills + motion + sound</span>
                <span>Model routing</span>
              </div>
              <Link className="ar-project-link" href="/ai-studio">
                Explore AI Content Studio <span aria-hidden>↗</span>
              </Link>
              <p className="ar-access-note">
                Browse the workflows. Live generation is available by request.
              </p>
            </div>
            <div className="ar-studio-visual">
              <CreamFilm />
              <details className="ar-film-references">
                <summary>Explore the appearance references</summary>
              <div className="ar-image-triptych">
                {REFERENCES.map((r) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={r.src}
                    src={r.src}
                    width={435}
                    height={780}
                    alt={r.alt}
                    loading="lazy"
                  />
                ))}
              </div>
              <div className="ar-image-caption">
                <span>Behind the film</span>
                <span>Appearance references</span>
              </div>
              </details>
            </div>
          </article>

          <div className="ar-project-pair">
            <article>
              <div className="ar-project-meta">
                <span className="ar-eyebrow">02 / Persopot</span>
                <span className="ar-status">Consumer product</span>
              </div>
              <div className="ar-perso-visual">
                <span className="ar-perso-title">persopot.</span>
                <div className="ar-perso-orbit">
                  <span>Headshots</span>
                  <span>Try it on</span>
                  <span>Ask a bestie</span>
                </div>
                <span className="ar-perso-caption">Your identity. More possibilities.</span>
              </div>
              <h3>AI with a social life.</h3>
              <p>
                Studio headshots and outfit try-ons, built around one identity. Shared
                collections make the result part of a conversation, with the people whose
                opinions matter.
              </p>
              <a
                className="ar-project-link"
                href="https://persopot.com"
                target="_blank"
                rel="noreferrer"
              >
                Visit Persopot <span aria-hidden>↗</span>
              </a>
            </article>

            <article>
              <div className="ar-project-meta">
                <span className="ar-eyebrow">03 / Project Forge</span>
                <span className="ar-status ar-status-internal">Internal · Loblaw</span>
              </div>
              <div className="ar-forge-visual">
                <span className="ar-forge-monogram" aria-hidden>
                  F<span>↗</span>
                </span>
                <ol aria-label="Project Forge workflow">
                  <li>Brief</li>
                  <li>Build</li>
                  <li>Review</li>
                  <li>Deploy</li>
                </ol>
                <span className="ar-forge-caption">
                  A clearer path from request to release.
                </span>
              </div>
              <h3>Make the work flow.</h3>
              <p>
                An internal platform for promotional email badges: intake, bilingual
                briefs, review, QA and sign-off. One connected workflow for marketers and
                production teams.
              </p>
              <Link className="ar-project-link" href="/project-forge">
                View Forge case study <span aria-hidden>↗</span>
              </Link>
            </article>
          </div>
        </section>

        {/* ----------------------------- Approach ---------------------------- */}
        <section className="ar-approach" id="ar-approach" aria-labelledby="ar-story-heading">
          <div className="ar-wrap ar-story-grid">
            <div className="ar-story-title">
              <p className="ar-eyebrow">03 / Staying ahead</p>
              <h2 id="ar-story-heading">
                The next model
                <br />
                is coming.
                <br />
                <em>So is the next brief.</em>
              </h2>
              <span className="ar-story-mark" aria-hidden>
                ↗
              </span>
            </div>
            <div className="ar-story-body">
              <p className="ar-story-lead">
                New models. New possibilities.
                <br />
                The real question is what&rsquo;s ready to work.
              </p>
              <p>
                A launch can change what&rsquo;s possible overnight. A production brief
                asks harder questions: can it hold the packaging, render the French copy,
                meet the deadline and stay inside the budget?
              </p>
              <p>
                That&rsquo;s where I spend my time. I test new capabilities against real
                work, build around the ones that hold up, and keep the system flexible
                enough for what comes next.
              </p>
              <p className="ar-story-punch">
                Staying ahead is a practice.
                <br />
                <span>Curiosity. Testing. Shipping. Repeat.</span>
              </p>
              <Link className="ar-text-link" href="/ai-studio/models">
                Inside my model toolkit <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>

          <div className="ar-wrap ar-method">
            {METHOD.map((m) => (
              <article key={m.n}>
                <span className="ar-method-number">{m.n}</span>
                <h3>{m.h}</h3>
                <p>{m.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ------------------------------ Contact ---------------------------- */}
      </main>

      <footer className="ar-contact" id="ar-contact">
        <div className="ar-wrap">
          <div className="ar-contact-heading">
            <div>
              <p className="ar-eyebrow">Have something in mind?</p>
              <h2>
                Let&rsquo;s build
                <br />
                <em>what&rsquo;s next.</em>
              </h2>
            </div>
            <a
              className="ar-contact-circle"
              href="mailto:hello@ajwadrauf.com"
              aria-label="Email Ajwad Rauf"
            >
              <span aria-hidden>↗</span>
            </a>
          </div>
          <div className="ar-contact-bottom">
            <a href="mailto:hello@ajwadrauf.com">hello@ajwadrauf.com</a>
            <a
              href="https://www.linkedin.com/in/ajwadrauf"
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn ↗
            </a>
            <span>Ajwad Rauf · Toronto · 2026</span>
            <a href="#ar-top">Back to top ↑</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
