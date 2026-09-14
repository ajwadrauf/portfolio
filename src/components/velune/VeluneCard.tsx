import Link from "next/link";
import { VELUNE_MEDIA } from "./veluneStudy";
import styles from "./Velune.module.css";

export function VeluneCard({ compact = false }: { compact?: boolean }) {
  return (
    <article className={`${styles.card} ${compact ? styles.compactCard : ""}`} aria-labelledby={compact ? "velune-studio-title" : "velune-home-title"}>
      <div className={styles.cardImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={VELUNE_MEDIA.campaignStill} width={1920} height={1080} alt="VELUNE campaign still: three filled chocolate centres in a warm chocolate passage, with Wonder within set beside them" loading="lazy" />
        <span>Campaign still / Wonder within.</span>
      </div>
      <div className={styles.cardCopy}>
        <p className={styles.eyebrow}>VELUNE / Independent concept</p>
        <span className={styles.status}>Film · Stills · After Effects</span>
        <h3 id={compact ? "velune-studio-title" : "velune-home-title"}>A little chocolate.<br />A world within.</h3>
        <p>A chocolate campaign spanning film, stills and social, with a fifteen-second Adobe After Effects motion study built through AI-assisted scripting. Follow the decisions from visual references to delivery, then explore editable typography, 3D carton moves and a chocolate portal reveal.</p>
        <Link className={styles.cta} href="/velune">Explore the VELUNE campaign <span aria-hidden>↗</span></Link>
        <Link className={styles.referenceJump} href="/velune#after-effects">Watch the After Effects study <span aria-hidden>↗</span></Link>
      </div>
    </article>
  );
}
