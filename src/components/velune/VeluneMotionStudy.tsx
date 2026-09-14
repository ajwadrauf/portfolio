import Image from "next/image";
import { VELUNE_MOTION } from "./veluneStudy";
import styles from "./Velune.module.css";

const MOMENTS = [
  {
    time: "00–03s / Curiosity",
    title: "Type becomes part of the scene.",
    body: "Individual letters arrive from depth while gold contours trace the chocolate. The opening reads even with sound off.",
    image: VELUNE_MOTION.opening,
    alt: "WONDER lettering surrounded by gold contours over the chocolate macro scene",
  },
  {
    time: "03–07s / The collection",
    title: "Give the cartons a little theatre.",
    body: "Three photographic carton cards rotate into place in a 3D scene. Their artwork stays intact as the camera moves.",
    image: VELUNE_MOTION.collection,
    alt: "Three VELUNE flavour cartons arranged in the After Effects collection scene",
  },
  {
    time: "10–15s / Wonder within",
    title: "Make the ending feel earned.",
    body: "A circular reveal opens into the chocolate world. The emblem draws on, the name settles and the light slowly falls.",
    image: VELUNE_MOTION.closing,
    alt: "VELUNE and Wonder within above the three chocolate centres in the closing scene",
  },
] as const;

export function VeluneMotionStudy() {
  return (
    <section className={styles.motionSection} id="after-effects" aria-labelledby="motion-heading">
      <div className={styles.wrap}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>08 / After Effects motion study</p>
            <h2 id="motion-heading">A different kind<br /><em>of wonder.</em></h2>
          </div>
          <p>The same chocolate world, with a new motion language. Animated lettering, 3D carton moves and a gold portal reveal bring more expression to the brand, with control over every keyframe.</p>
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
            <h3>A finish you can keep working on.</h3>
            <p>Editable text, shape paths, cameras and keyframes live in a native After Effects project. Change a headline, swap the carton artwork or adjust the timing. The included script rebuilds the composition from its source assets.</p>
          </div>
          <div className={styles.motionHandoffAction}>
            <a href={VELUNE_MOTION.bundle} download>Download the editable project <span aria-hidden="true">↓</span></a>
            <p>ZIP · 44 MB · After Effects 2026<br />Project, script, assets, MP4 and instructions</p>
          </div>
        </div>
        <p className={styles.motionCredit}>My role: creative direction, reference selection and review, with AI-assisted scripting and motion development. Built and rendered in Adobe After Effects using the existing VELUNE imagery, a short H3 sequence and the campaign’s H3 / ElevenLabs sound mix.</p>
        <a className={styles.deliveryBack} href="#velune-film">Revisit the campaign delivery ↑</a>
      </div>
    </section>
  );
}
