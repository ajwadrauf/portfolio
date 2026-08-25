import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Nav } from "@/components/Nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Content Studio — Ajwad Rauf",
  description:
    "A working AI content production pipeline: one product photo in, a multi-format retail campaign out. Built with Gemini (Nano Banana, Veo 3.1), Flux and Kling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border-soft py-8">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-sm text-muted sm:flex-row sm:justify-between">
            <p>
              Built by Ajwad Rauf — a working demo of an AI Content Studio for
              retail production.
            </p>
            <div className="flex gap-4">
              <Link href="/models" className="hover:text-foreground">Model landscape</Link>
              <Link href="/build-vs-buy" className="hover:text-foreground">Build vs. buy</Link>
              <Link href="/playbook" className="hover:text-foreground">Playbook</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
