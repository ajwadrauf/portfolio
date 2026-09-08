/**
 * The site wordmark: four tokens, the name, a plum full stop.
 *
 * One component rather than three near-copies. The homepage, the studio nav
 * and the case study each used to draw their own identity — a tilted token
 * mark, a two-weight name over a gradient rule, and a mono uppercase label —
 * which meant the site introduced itself differently on every page.
 *
 * Renders a span, not a link, so each caller keeps its own destination: the
 * homepage points at its own top, the studio and the case study point home.
 */
export function Wordmark({
  /** lg (27px, 24 on a phone) for the homepage header, sm for a back link. */
  size = "lg",
  className = "",
}: {
  size?: "lg" | "md" | "sm";
  className?: string;
}) {
  const scale = size === "lg" ? "" : `wordmark-${size}`;
  return (
    <span className={`wordmark ${scale} ${className}`.trim()}>
      <span className="wordmark-mark" aria-hidden>
        <span />
        <span />
        <span />
        <span />
      </span>
      ajwad rauf<span className="wordmark-period">.</span>
    </span>
  );
}
