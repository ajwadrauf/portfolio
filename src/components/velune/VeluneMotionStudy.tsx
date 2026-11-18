import Image from "next/image";
import { VELUNE_MOTION } from "./veluneStudy";
import styles from "./Velune.module.css";

const MOMENTS = [
  {
    time: "00–03s / Curiosity",
    title: "Type enters from depth",
    body: "Letters arrive as gold contours trace the chocolate. The opening reads with the sound off.",
    image: VELUNE_MOTION.opening,
    alt: "WONDER lettering surrounded by gold contours over the chocolate macro scene",
  },
  {
    time: "03–07s / The collection",
    title: "Three cartons in motion",
    body: "The cartons rotate in 3D while their photographic artwork stays intact.",
    image: VELUNE_MOTION.collection,
    alt: "Three VELUNE flavour cartons arranged in the After Effects collection scene",
  },
  {
    time: "10–15s / Wonder within",
    title: "The light falls on the reveal",
    body: "A circular reveal opens onto the three chocolates. The emblem draws on and the light slowly falls.",
    image: VELUNE_MOTION.closing,
    alt: "VELUNE and Wonder within above the three chocolate centres in the closing scene",
  },
] as const;

export function VeluneMotionStudy() {
  return (
    <section className={styles.motionSection} id="after-effects" aria-labelledby="motion-heading" tabIndex={-1}>
      <div className={styles.wrap}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>After Effects motion study</p>
            <h2 id="motion-heading">Wonder Lab</h2>
          </div>
          <p>A companion film that explores animated lettering, 3D carton moves and a gold portal reveal.</p>
        </div>
        <video
          className={styles.finalVideo}
          src={VELUNE_MOTION.film}
          poster={VELUNE_MOTION.poster}
          width={1920}
          height={1080}
          controls
          playsInline
          preload="none"
          aria-label="VELUNE Wonder Lab, a fifteen-second After Effects motion study with sound"
        >
          Your browser does not support video. <a href={VELUNE_MOTION.film}>Download the motion film.</a>
        </video>
        <div className={styles.motionFilmNote}>
          <p>15 seconds · 1920 × 1080 · Sound included</p>
          <a href={VELUNE_MOTION.film} download>Download the motion film ↓</a>
        </div>
        <div className={styles.motionMoments}>
          {MOMENTS.map((moment) => (
            <figure key={moment.time}>
              <Image src={moment.image} width={960} height={540} alt={moment.alt} sizes="(max-width: 760px) 90vw, 30vw" />
              <figcaption>
                <span className={styles.eyebrow}>{moment.time}</span>
                <h3>{moment.title}</h3>
                <p>{moment.body}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className={styles.motionHandoff}>
          <div>
            <p className={styles.eyebrow}>Inside the project</p>
            <h3>Editable motion project</h3>
            <p>Edit the text, paths, cameras and keyframes in After Effects. The included script can rebuild the composition from its source assets.</p>
          </div>
          <div className={styles.motionHandoffAction}>
            <a href={VELUNE_MOTION.bundle} download>Download the editable project <span aria-hidden="true">↓</span></a>
            <p>ZIP · 44 MB · After Effects 2026<br />Project, script, assets, MP4 and instructions</p>
          </div>
        </div>
        <p className={styles.motionCredit}><strong>My role</strong> · Creative direction, reference selection and review, with AI-assisted scripting. The After Effects render uses VELUNE imagery, a short H3 sequence and the campaign sound mix.</p>
        <a className={styles.deliveryBack} href="#velune-film">Continue to the finished campaign ↓</a>
      </div>
    </section>
  );
}
