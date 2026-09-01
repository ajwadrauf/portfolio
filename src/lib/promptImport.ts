/**
 * Bringing a prompt written somewhere else into the lab.
 *
 * The Blender page composes a Seedance prompt; the lab runs it through the
 * fal API. Those two surfaces address references with different sigils —
 * `@Video 1` in a playground, `[Video1]` through the API — and the API reads
 * an unconverted `@Video 1` as literal text. So the reference resolves to
 * nothing, the model invents a subject, and the render looks plausible enough
 * that the mistake is only obvious once the bill arrives. Converting on import
 * is the whole reason this module exists; hiding a few form steps is the easy
 * half.
 *
 * Everything here is pure so it can be tested without a browser, and nothing
 * is applied silently — `notes` exists so the UI can say what it changed.
 */

export type ImportedPrompt = {
  /** The prompt, fences stripped and reference tokens converted. */
  prompt: string;
  /** What was changed or noticed, in the order it happened. */
  notes: string[];
  /** Read out of the text when it is stated. */
  seconds?: number;
  /** Read out of the text when it is stated, unvalidated — callers check it. */
  aspect?: string;
  /** Highest [ImageN] / [VideoN] / [AudioN] the prompt addresses. */
  slots: { image: number; video: number; audio: number };
};

/** What the file picker accepts. Plain text and Markdown, nothing else. */
export const PROMPT_FILE_ACCEPT = ".txt,.md,.markdown,text/plain,text/markdown";

/**
 * A prompt is a few kilobytes. Anything past this is a document that happens
 * to have a prompt in it, or a file picked by mistake — either way, reading
 * 40MB into a textarea helps nobody.
 */
export const MAX_PROMPT_FILE_BYTES = 256 * 1024;

/** Extensions we will read. A `.docx` is a zip and would arrive as mojibake. */
const TEXT_EXTENSIONS = /\.(txt|md|markdown|text)$/i;

export function isPromptFile(file: { name: string; type: string }) {
  return (
    TEXT_EXTENSIONS.test(file.name) ||
    file.type === "text/plain" ||
    file.type === "text/markdown"
  );
}

/**
 * Pulls the prompt out of a Markdown document.
 *
 * A prompt saved as `.md` is usually one of two things: the bare prompt with a
 * `.md` extension, or a note with the prompt in a fenced block and commentary
 * around it. Taking the longest fenced block handles the second without
 * damaging the first, which has no fences to find.
 */
export function stripMarkdown(raw: string): { text: string; note?: string } {
  let text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");

  // YAML front matter, which is metadata about the prompt and not the prompt.
  const fm = text.match(/^---\n[\s\S]*?\n---\n/);
  if (fm) text = text.slice(fm[0].length);

  const fences = [...text.matchAll(/^(?:```|~~~)[^\n]*\n([\s\S]*?)^(?:```|~~~)\s*$/gm)];
  if (fences.length > 0) {
    const longest = fences.reduce((a, b) => (b[1].length > a[1].length ? b : a));
    return {
      text: longest[1].trim(),
      note:
        fences.length === 1
          ? "Took the fenced code block and left the commentary around it."
          : `Found ${fences.length} fenced blocks and took the longest one.`,
    };
  }

  return { text: text.trim() };
}

/**
 * `@Image 1` → `[Image1]`.
 *
 * Handles the space and the missing space, upper and lower case, and the
 * half-converted `[Image 1]` — all four turn up in prompts people paste. The
 * pattern deliberately does not match a bare `@` or a word without a number,
 * so an email address or a handle in the creative direction is left alone.
 */
export function normalizeRefTokens(text: string): { text: string; changed: number } {
  let changed = 0;
  const out = text
    .replace(/@\s*(image|video|audio)\s*(\d+)/gi, (_m, kind: string, n: string) => {
      changed++;
      return `[${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()}${Number(n)}]`;
    })
    .replace(/\[\s*(image|video|audio)\s+(\d+)\s*\]/gi, (_m, kind: string, n: string) => {
      changed++;
      return `[${kind[0].toUpperCase()}${kind.slice(1).toLowerCase()}${Number(n)}]`;
    });
  return { text: out, changed };
}

/** The highest slot of each kind the prompt actually addresses. */
export function refSlots(text: string) {
  const top = (kind: string) => {
    const ns = [...text.matchAll(new RegExp(`\\[${kind}(\\d+)\\]`, "gi"))].map((m) =>
      Number(m[1]),
    );
    return ns.length ? Math.max(...ns) : 0;
  };
  return { image: top("Image"), video: top("Video"), audio: top("Audio") };
}

/**
 * The length the prompt was written for.
 *
 * A 12-second timeline rendered at 8 seconds does not get shorter, it gets
 * truncated — the last beat simply never happens. So the stated length comes
 * across with the prompt rather than leaving the slider wherever it was.
 */
export function readDuration(text: string): number | undefined {
  // "SETTINGS: … · 12s · 1:1 · 720p"
  const settings = text.match(/^SETTINGS:.*$/im)?.[0];
  const stated = settings?.match(/(\d+(?:\.\d+)?)\s*s\b/i);
  if (stated) return round(Number(stated[1]));

  // Failing that, the end of the last timeline beat: "9-12s:  …"
  const beats = [...text.matchAll(/^\s*(?:\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)\s*s\s*:/gim)];
  if (beats.length) return round(Math.max(...beats.map((m) => Number(m[1]))));

  return undefined;
}

const round = (n: number) =>
  Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;

/** The shape the prompt was written for, if it says so. */
export function readAspect(text: string): string | undefined {
  const settings = text.match(/^SETTINGS:.*$/im)?.[0];
  return settings?.match(/\b(\d{1,2}:\d{1,2})\b/)?.[1];
}

/** Everything above, in one pass, with the running commentary. */
export function importPrompt(raw: string): ImportedPrompt {
  const notes: string[] = [];
  const { text: stripped, note } = stripMarkdown(raw);
  if (note) notes.push(note);

  const { text, changed } = normalizeRefTokens(stripped);
  if (changed > 0) {
    notes.push(
      `Converted ${changed} reference token${changed === 1 ? "" : "s"} to the bracketed form the API resolves — @Image 1 becomes [Image1]. Left as written, they read as literal text and the reference is ignored.`,
    );
  }

  const seconds = readDuration(text);
  if (seconds) notes.push(`Read a length of ${seconds}s out of the prompt and set the slider to it.`);

  // The aspect is reported but not narrated here: whether it can be applied
  // depends on which shapes the chosen endpoint offers, which only the caller
  // knows. A note claiming a change that did not happen is worse than none.
  return { prompt: text, notes, seconds, aspect: readAspect(text), slots: refSlots(text) };
}
