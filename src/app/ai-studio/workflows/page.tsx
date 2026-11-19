import type { Metadata } from "next";
import Link from "next/link";
import { CartonCompare, WorkflowInspector } from "./StudyControls";
import { media } from "./study";
import styles from "./workflows.module.css";

export const metadata: Metadata = {
  title: "Creative Flows · VELUNE carton study · The Workroom",
  description: "An independent VELUNE production study. Compare ComfyUI and Figma Weave runs, inspect the graphs, and see how the selected carton images were finished.",
  alternates: { canonical: "https://www.ajwadrauf.com/ai-studio/workflows" },
  openGraph: { images: [{ url: `https://www.ajwadrauf.com${media}/finished-premium.webp`, alt: "Finished VELUNE Raspberry Ganache carton in amber studio light" }] },
};

const comparison = [
  ["Creative control", "Explicit latent conditioning, sampler, scheduler and export settings.", "A shared canvas made art direction, branching and review visible together."],
  ["Product fidelity", "Strong front layout. The model darkened the chocolate graphic and made the paper redder.", "Main labels stayed legible. The social branch tilted the box, shifted the artwork and intensified the red."],
  ["Iteration", "Individual branches can change at the prompt, latent, sampler or finishing stage.", "A reviewer can open a prompt, run its model node and compare with the other branch on the same canvas."],
  ["Model flexibility", "Native weights and explicit loading. This run used the Kontext Dev FP8 checkpoint.", "Hosted model selection inside the same canvas. This test used Kontext Dev only."],
  ["Production use", "Version the editable JSON, original input and PNG metadata for repeatable jobs.", "Share the brief and candidates with creative teams. The tested canvas is view-only by link."],
  ["Image quality", "Selected for the quiet premium set and amber falloff.", "Selected for the diagonal light and contrast in social."],
  ["Cost observed", "1 free cloud run for 2 outputs. 4 of 5 free runs remained.", "2 model runs × 3 credits. 144 of 150 trial credits remained."],
  ["Reuse at scale", "Parameterize the reference and prompts, preserve settings and add a package review gate.", "Reuse the reference and prompt branches for new SKUs. Publishing a reusable Tool would be a separate step."],
] as const;

export default function WorkflowCase() {
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <nav className={styles.breadcrumb} aria-label="Case study navigation">
          <Link href="/ai-studio">← The Workroom</Link>
          <Link href="/velune">VELUNE campaign ↗</Link>
        </nav>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Creative Flows / VELUNE carton study</p>
            <h1>Raspberry Ganache</h1>
          </div>
          <div className={styles.intro}>
            <p>Two lighting treatments for the same carton, tested in ComfyUI and Figma Weave. I reviewed what happened to the packaging as the set changed.</p>
            <p className={styles.credit}>Independent study · Ajwad Rauf</p>
          </div>
        </header>

        <CartonCompare />
        <WorkflowInspector />

        <section className={styles.director} aria-labelledby="review-heading">
          <div>
            <p className={styles.kicker}>Creative director’s review</p>
            <h2 id="review-heading">Where the carton changed</h2>
            <p>At full size, the chocolate on both selected cartons looked darker and the paper had turned redder. I mapped the reference artwork onto the front face and kept the generated scene, shadow and side face.</p>
            <Link href="/velune#creative-review" className={styles.textLink}>See the carton correction in the original film case ↗</Link>
          </div>
          <div className={styles.reviewNotes}>
            <h3>Before a production release</h3>
            <p>Apply approved artwork to every visible face, proof the colour and lettering, and check the crop and type in each placement. The carton in this study is concept artwork.</p>
            <a className={styles.textLink} href={`${media}/velune-raspberry-reference.png`} download>Download the shared carton reference ↓</a>
          </div>
        </section>

        <section className={styles.comparisonSection} aria-labelledby="table-heading">
          <div className={styles.sectionHead}>
            <h2 id="table-heading">ComfyUI and Figma Weave</h2>
            <p>Both used the same input, prompts and seed with FLUX.1 Kontext Dev. Weave manages its own runtime and ComfyUI exposed an FP8 checkpoint and sampler settings. The different output sizes and execution paths limit any model-quality or cost comparison.</p>
          </div>
          <table className={styles.table} aria-label="ComfyUI and Figma Weave production comparison">
            <thead><tr><th scope="col">Criteria</th><th scope="col">ComfyUI</th><th scope="col">Figma Weave</th></tr></thead>
            <tbody>{comparison.map(([label, comfy, weave]) => (
              <tr key={label}><th scope="row">{label}</th><td>{comfy}</td><td>{weave}</td></tr>
            ))}</tbody>
          </table>
        </section>

        <section className={styles.handoff} aria-labelledby="handoff-heading">
          <h2 id="handoff-heading">From study to production</h2>
          <ol>
            <li><strong>Source the product</strong><span>Product Shots and Blender already provide artwork views and camera references.</span></li>
            <li><strong>Explore the set</strong><span>ComfyUI and Weave ran externally. This study uses saved renders and an exported graph.</span></li>
            <li><strong>Review and finish</strong><span>Select the lighting, restore approved artwork and add editable type or motion in finishing.</span></li>
            <li><strong>Proposed studio link</strong><span>Attach the selected plate, prompt, graph and review decision to a Campaigns project. Keep model runs behind studio access and budget controls.</span></li>
          </ol>
          <div className={styles.handoffLinks}>
            <Link href="/velune#campaign-assembly">Inspect the VELUNE campaign workflow ↗</Link>
            <Link href="/ai-studio/studio">Explore Campaigns ↗</Link>
            <Link href="/velune#after-effects">See editable After Effects finishing ↗</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
