"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  MIN_SCORE,
  type LibraryPrompt,
  type PromptLibrary as Library,
  type PromptCategory,
} from "@/lib/promptLibrary";

const HANDOFF_KEY = "adlab-imported-prompt";

export function PromptLibrary({ library }: { library: Library }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PromptCategory | "all">("all");
  const [copied, setCopied] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of library.prompts) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [library.prompts]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.prompts.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return p.text.toLowerCase().includes(q) || p.signals.some((s) => s.includes(q));
    });
  }, [library.prompts, query, category]);

  const copy = async (p: LibraryPrompt) => {
    try {
      await navigator.clipboard.writeText(p.text);
      setCopied(p.id);
      setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1600);
    } catch {
      setCopied(null);
    }
  };

  /** Hands the prompt to the Ad Lab so it can be run, not just read. */
  const sendToAdLab = (p: LibraryPrompt) => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, p.text);
    } catch {}
    router.push("/ai-studio/ads");
  };

  if (library.prompts.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-[1.75rem] tracking-[-0.03em]">Prompt datasets</h1>
        <div className="card mt-6 border-warning/40 bg-warning/[0.06] p-6">
          <p className="label !text-warning">Not yet ingested</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            The library is built once from{" "}
            <a
              href={library.source.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              the dataset
            </a>{" "}
            and committed, so the page depends on no third party staying up.
            Either page the dataset server directly:
          </p>
          <pre className="mt-4 overflow-x-auto rounded-[6px] border border-border-soft bg-surface-2 p-4 font-mono text-xs">
node scripts/ingest-prompts.mjs --from-api --inspect   # check the schema
node scripts/ingest-prompts.mjs --from-api             # build the library
          </pre>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            …or, where huggingface.co is unreachable, download{" "}
            <code className="font-mono text-xs text-foreground">metadata.jsonl</code>{" "}
            and pass it as a file:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-[6px] border border-border-soft bg-surface-2 p-4 font-mono text-xs">
node scripts/ingest-prompts.mjs --inspect metadata.jsonl
node scripts/ingest-prompts.mjs metadata.jsonl
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-[1.75rem] tracking-[-0.03em]">Prompt datasets</h1>
      <p className="mt-2 max-w-3xl text-muted">
        A study set of{" "}
        <span className="font-semibold text-foreground">
          {library.prompts.length} product-focused prompts
        </span>{" "}
        filtered out of {library.source.consideredRows.toLocaleString()} rows of
        the public Seedance 2 corpus. These are other people&apos;s prompts,
        kept with attribution — what is mine is the filter that found them.
      </p>

      {/* Provenance, stated before the content rather than in a footer. */}
      <div className="card mt-6 border-warning/30 bg-warning/[0.05] p-4">
        <p className="label !text-warning">Source and rights</p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
          {library.source.licenseNote} Curated by{" "}
          <a
            href={library.source.url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-accent hover:underline"
          >
            {library.source.name}
          </a>
          . Ingested {library.source.ingestedAt}. Nothing here is my writing,
          and none of it is presented as a preset — the presets in the Ad Lab
          are mine and are structured differently.
        </p>
      </div>

      {/* The filter is the actual work, so it is shown rather than asserted. */}
      <details className="card mt-4 p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          How {library.source.consideredRows.toLocaleString()} rows became{" "}
          {library.prompts.length}
        </summary>
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
          A general video corpus is mostly character work, landscapes and
          anime — almost none of it is retail. Each prompt is scored against
          six category vocabularies drawn from how a photographer actually
          briefs a shot (packshot, macro, physics, lighting, food, graphic),
          two points a term. Generic commercial words score one, as
          tie-breakers only. Anything matching an off-brief subject is dropped
          outright, anything under {MIN_SCORE} points is dropped, near-duplicates
          are collapsed on their first 24 words, and the rest is ranked by
          score. Every entry below shows the signals that got it in, so the
          filter can be argued with rather than trusted.
        </p>
      </details>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <input
          className="input min-w-0 flex-1 basis-64"
          placeholder="Search prompts — try 'condensation', 'rim light', 'turntable'…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(30);
          }}
        />
        <span className="label-sm whitespace-nowrap">
          {results.length} of {library.prompts.length}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setCategory("all");
            setLimit(30);
          }}
          className={`chip transition ${category === "all" ? "border-accent !text-accent" : "hover:border-accent/50"}`}
        >
          All · {library.prompts.length}
        </button>
        {CATEGORIES.filter((c) => counts[c.id]).map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setCategory(c.id);
              setLimit(30);
            }}
            title={c.blurb}
            className={`chip transition ${category === c.id ? "border-accent !text-accent" : "hover:border-accent/50"}`}
          >
            {c.label} · {counts[c.id]}
          </button>
        ))}
      </div>

      {category !== "all" && (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          {CATEGORIES.find((c) => c.id === category)?.blurb}
        </p>
      )}

      {/* Results */}
      <div className="mt-6 space-y-3">
        {results.slice(0, limit).map((p) => (
          <article key={p.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="label-sm !text-accent">
                {CATEGORIES.find((c) => c.id === p.category)?.label}
              </span>
              <span className="label-sm">
                {p.author ? `by ${p.author}` : "author not recorded"}
                {p.aspect ? ` · ${p.aspect}` : ""}
                {p.durationSeconds ? ` · ${p.durationSeconds}s` : ""}
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed">{p.text}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-soft pt-3">
              <button
                className="btn-secondary !px-3 !py-1.5 text-xs"
                onClick={() => void copy(p)}
              >
                {copied === p.id ? "Copied" : "Copy"}
              </button>
              <button
                className="btn-secondary !px-3 !py-1.5 text-xs"
                onClick={() => sendToAdLab(p)}
              >
                Send to Ad Lab →
              </button>
              {p.sourceUrl && (
                <a
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Original
                </a>
              )}
              <span className="ml-auto flex flex-wrap gap-1.5">
                {p.signals.slice(0, 4).map((s) => (
                  <span
                    key={s}
                    className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted"
                  >
                    {s}
                  </span>
                ))}
              </span>
            </div>
          </article>
        ))}
      </div>

      {results.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          Nothing matches that. Try a shorter term.
        </p>
      )}

      {results.length > limit && (
        <button
          className="btn-secondary mt-6 w-full"
          onClick={() => setLimit((l) => l + 40)}
        >
          Show more — {results.length - limit} left
        </button>
      )}
    </div>
  );
}
