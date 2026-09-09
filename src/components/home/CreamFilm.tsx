import Link from "next/link";
import { CreamCompare } from "@/components/studio/CreamCompare";
import styles from "./CreamFilm.module.css";

/** Show the authored direction and generated result on first sight. */
export function CreamFilm() {
  return (
    <div className={styles.film}>
      <div className={styles.heading}>
        <span>From Blender to the final frame</span>
        <span>18 seconds / Cream in motion</span>
      </div>
      <CreamCompare compact id="home-cream-comparison" />
      <div className={styles.caption}>
        <span>One camera plan. Five images. See what changes.</span>
        <Link href="/ai-studio/ads#cream-making-of">See how it was made <span aria-hidden>↗</span></Link>
      </div>
    </div>
  );
}
