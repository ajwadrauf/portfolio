/**
 * Portfolio header.
 *
 * Three links and a wordmark, and nothing else — the page below is short
 * enough that a menu would be a lid on a box with three things in it. The
 * studio keeps its own navigation (Nav.tsx); crossing between the two halves
 * of the site is meant to feel like arriving somewhere, not like the same
 * chrome with different contents.
 *
 * Deliberately a server component. Every link is a real anchor that works
 * before any JavaScript arrives; SmoothAnchors only upgrades how they travel.
 */
export function HomeNav() {
  return (
    <header className="ar-nav ar-wrap">
      <a className="ar-wordmark" href="#ar-top" aria-label="Ajwad Rauf, back to top">
        {/* Four tokens, tilted — the sculpture's own unit, at wordmark size. */}
        <span className="ar-mark" aria-hidden>
          <b />
          <b />
          <b />
          <b />
        </span>
        ajwad rauf<span className="ar-period">.</span>
      </a>
      <nav aria-label="Main navigation">
        <a href="#ar-work">Selected work</a>
        <a href="#ar-approach">My approach</a>
        <a className="ar-nav-contact" href="#ar-contact">
          Let&rsquo;s talk <span aria-hidden>↗</span>
        </a>
      </nav>
    </header>
  );
}
