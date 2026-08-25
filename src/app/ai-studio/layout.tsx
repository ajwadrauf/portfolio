import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function StudioLayout({ children }: LayoutProps<"/ai-studio">) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border-soft bg-surface py-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="label-sm">
            A project by{" "}
            <Link href="/" className="text-accent hover:text-accent-soft">
              Ajwad Rauf
            </Link>{" "}
            · Toronto · 2026
          </p>
          <div className="flex flex-wrap gap-5">
            <Link href="/ai-studio/models" className="label-sm hover:text-foreground">
              Model landscape
            </Link>
            <Link href="/ai-studio/build-vs-buy" className="label-sm hover:text-foreground">
              Build vs. buy
            </Link>
            <Link href="/ai-studio/playbook" className="label-sm hover:text-foreground">
              Playbook
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
