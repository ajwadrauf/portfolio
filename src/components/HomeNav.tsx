import { Wordmark } from "@/components/Wordmark";

export function HomeNav() {
  return (
    <header className="ar-nav-shell">
      <div className="ar-nav ar-wrap">
        <a href="#ar-top" aria-label="Ajwad Rauf, back to top"><Wordmark /></a>
        <nav aria-label="Main navigation">
          <a href="#ar-work">Selected work</a>
          <a href="#ar-studio">The Workroom</a>
          <a href="#ar-leadership">Leadership</a>
          <a href="#ar-contact">Contact</a>
        </nav>
      </div>
    </header>
  );
}
