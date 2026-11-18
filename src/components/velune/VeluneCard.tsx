import Image from "next/image";
import Link from "next/link";
import { VELUNE_MEDIA } from "./veluneStudy";
import styles from "./Velune.module.css";

export function VeluneCard({ compact = false }: { compact?: boolean }) {
  const titleId = compact ? "velune-studio-title" : "velune-home-title";

  return (
    <article className={`${styles.card} ${compact ? styles.compactCard : ""}`} aria-labelledby={titleId}>
      <figure className={styles.cardImage}>
        <Image
          src={VELUNE_MEDIA.campaignStill}
          width={1920}
          height={1080}
          alt="Three filled chocolates in a warm chocolate passage beside the words Wonder within"
          sizes={compact ? "(max-width: 740px) 95vw, 530px" : "(max-width: 740px) 95vw, 690px"}
        />
        <figcaption>VELUNE campaign still</figcaption>
      </figure>
      <div className={styles.cardCopy}>
        <p className={styles.cardLabel}>Independent campaign concept</p>
        <h3 id={titleId}>VELUNE</h3>
        <p>Three filled chocolates, a 15-second film and a packaging study in ComfyUI and Figma Weave. The campaign includes social, bilingual and editable motion work.</p>
        <div className={styles.cardLinks}>
          <Link href="/velune">Explore the VELUNE campaign <span aria-hidden>↗</span></Link>
          <Link href="/ai-studio/workflows">Compare the carton workflows <span aria-hidden>↗</span></Link>
          {compact && <Link href="/velune#after-effects">Watch the After Effects study <span aria-hidden>↗</span></Link>}
        </div>
      </div>
    </article>
  );
}
