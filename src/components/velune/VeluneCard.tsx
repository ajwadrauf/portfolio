import Link from "next/link";
import { VELUNE_MEDIA } from "./veluneStudy";
import styles from "./Velune.module.css";

export function VeluneCard({ compact = false }: { compact?: boolean }) {
  return (
    <article className={`${styles.card} ${compact ? styles.compactCard : ""}`} aria-labelledby={compact ? "velune-studio-title" : "velune-home-title"}>
      <div className={styles.cardImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={compact ? VELUNE_MEDIA.packaging : VELUNE_MEDIA.poster} width={compact ? 1440 : 1920} height={compact ? 904 : 1080} alt={compact ? "VELUNE packaging concepts in pistachio green, raspberry and caramel" : "Actual Blender camera-study frame: twelve VELUNE chocolates form a question mark above a tasting fork"} loading="lazy" />
        <span>{compact ? "Concept artwork" : "Blender camera study / The question"}</span>
      </div>
      <div className={styles.cardCopy}>
        <p className={styles.eyebrow}>VELUNE / Independent concept</p>
        <span className={styles.status}>Camera study · In production</span>
        <h3 id={compact ? "velune-studio-title" : "velune-home-title"}>A little chocolate.<br />A world within.</h3>
        <p>Twelve shots in fifteen seconds. A chocolate film taking shape through precise camera moves, registered cuts and a carefully held final frame.</p>
        <Link className={styles.cta} href="/velune">Explore the VELUNE study <span aria-hidden>↗</span></Link>
      </div>
    </article>
  );
}
