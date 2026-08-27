#!/usr/bin/env node
/**
 * Turns the GokuScraper Seedance 2 metadata.jsonl into the studio's prompt
 * library.
 *
 * Two modes:
 *   node scripts/ingest-prompts.mjs --inspect <file>   print the schema it found
 *   node scripts/ingest-prompts.mjs <file>             write the library JSON
 *
 * The dataset's exact field names are not documented, so nothing here is
 * hard-coded to one shape: the prompt, author, url, aspect and duration are
 * each detected from a list of plausible keys, and --inspect exists so a
 * surprising schema is a five-second diagnosis rather than a guess.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const OUT = path.join(process.cwd(), "src/data/prompt-library.json");
const SOURCE_URL = "https://huggingface.co/datasets/GokuScraper/seedance-2-prompts-datasets";

// --- field detection -------------------------------------------------------
const KEYS = {
  prompt: ["prompt", "text", "caption", "description", "prompt_en", "prompt_text", "content"],
  author: ["author", "user", "username", "creator", "uploader", "nickname", "author_name"],
  url: ["url", "source_url", "link", "page_url", "video_url", "share_url", "origin"],
  aspect: ["aspect_ratio", "aspect", "ratio"],
  duration: ["duration", "duration_seconds", "seconds", "length"],
};

const pick = (row, names) => {
  for (const n of names) {
    const v = row[n];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
};

// --- rubric (mirrors src/lib/promptLibrary.ts) -----------------------------
const CATEGORY_TERMS = {
  packshot: ["packshot","product shot","hero shot","bottle","can of","jar","packaging","package","label","box of","tube of","carton","cosmetic","perfume","skincare","sneaker","watch","handbag","on a pedestal","turntable","rotating product","on white"],
  "macro-texture": ["macro","extreme close-up","close-up of the surface","texture","droplet","condensation","grain","fibre","fiber","powder","crystal","bubbles","foam","shallow depth of field"],
  "motion-physics": ["slow motion","slow-motion","pour","pouring","splash","falling","levitat","float","spins","rotates","collides","shatter","ripple","swirl","cascade","bounce","physics"],
  "set-lighting": ["studio lighting","softbox","rim light","backlit","seamless","cyclorama","gel","key light","gradient background","spotlight","volumetric","caustics","reflection on","glossy surface"],
  "food-craft": ["steam rising","sizzl","melting","drizzl","crumb","sear","garnish","plated","coffee","chocolate","ice cream","juice","cocktail","batter","dough","glaze"],
  "graphic-motion": ["stop motion","stop-motion","kinetic typography","text animates","typography","flat lay","flat-lay","grid of","graphic","on-screen text","title card","isometric"],
};
const COMMERCIAL = ["commercial","advertisement","advertising","brand","campaign","premium","luxury","minimalist","clean background","product"];
const EXCLUDE = ["anime","manga","cartoon character","video game","gameplay","portrait of a woman","portrait of a man","young woman","young man","beautiful girl","handsome","nsfw","nude","bikini","lingerie","war","weapon","gun","blood","gore","zombie","monster","dragon","spaceship","alien","cyberpunk city","samurai","landscape","mountain range","forest","ocean waves","sunset over","cityscape","street scene","crowd","dancing","vlog","selfie","celebrity","politician","president"];

const MIN_SCORE = 3;
const MAX_PROMPTS = 500;
const LEN = { min: 80, max: 1800 };

/** Scores a prompt for retail-product relevance and picks its category. */
function classify(text) {
  const t = text.toLowerCase();
  for (const bad of EXCLUDE) if (t.includes(bad)) return null;

  const signals = [];
  let best = null;
  let bestHits = 0;
  let score = 0;

  for (const [cat, terms] of Object.entries(CATEGORY_TERMS)) {
    const hits = terms.filter((term) => t.includes(term));
    if (hits.length === 0) continue;
    // Two points per category term: these are the ones that mean something.
    score += hits.length * 2;
    signals.push(...hits);
    if (hits.length > bestHits) {
      bestHits = hits.length;
      best = cat;
    }
  }
  const commercialHits = COMMERCIAL.filter((term) => t.includes(term));
  score += commercialHits.length; // one point — weak on its own
  signals.push(...commercialHits);

  if (!best || score < MIN_SCORE) return null;
  return { category: best, score, signals: [...new Set(signals)].slice(0, 8) };
}

/** Collapses near-duplicates: the dataset repeats popular prompts verbatim. */
const fingerprint = (t) =>
  t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 24).join(" ");

async function* rows(file) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, "utf8"),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    try {
      yield JSON.parse(s);
    } catch {
      /* a malformed line is not worth failing 8,000 good ones over */
    }
  }
}

async function inspect(file) {
  const counts = new Map();
  let n = 0;
  const samples = [];
  for await (const row of rows(file)) {
    n++;
    for (const k of Object.keys(row)) counts.set(k, (counts.get(k) ?? 0) + 1);
    if (samples.length < 2) samples.push(row);
    if (n >= 400) break;
  }
  console.log(`Read ${n} rows.\n\nFields seen:`);
  for (const [k, c] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(24)} ${c}/${n}`);
  }
  console.log("\nDetected mapping:");
  for (const [want, names] of Object.entries(KEYS)) {
    const found = names.find((nm) => counts.has(nm));
    console.log(`  ${want.padEnd(10)} -> ${found ?? "NOT FOUND"}`);
  }
  console.log("\nFirst row:");
  console.log(JSON.stringify(samples[0], null, 2).slice(0, 1400));
}

async function build(file) {
  const seen = new Set();
  const kept = [];
  let considered = 0;
  let excluded = 0;
  let tooShort = 0;
  let dupes = 0;

  for await (const row of rows(file)) {
    considered++;
    const text = pick(row, KEYS.prompt);
    if (typeof text !== "string") continue;
    if (text.length < LEN.min || text.length > LEN.max) {
      tooShort++;
      continue;
    }
    const fp = fingerprint(text);
    if (seen.has(fp)) {
      dupes++;
      continue;
    }
    const verdict = classify(text);
    if (!verdict) {
      excluded++;
      continue;
    }
    seen.add(fp);

    const durationRaw = pick(row, KEYS.duration);
    kept.push({
      id: `p${kept.length + 1}`,
      text,
      category: verdict.category,
      score: verdict.score,
      signals: verdict.signals,
      author: pick(row, KEYS.author),
      sourceUrl: typeof pick(row, KEYS.url) === "string" ? pick(row, KEYS.url) : undefined,
      aspect: typeof pick(row, KEYS.aspect) === "string" ? pick(row, KEYS.aspect) : undefined,
      durationSeconds:
        typeof durationRaw === "number"
          ? Math.round(durationRaw)
          : typeof durationRaw === "string" && /^\d+$/.test(durationRaw)
            ? Number(durationRaw)
            : undefined,
    });
  }

  // Best-scoring first, then renumber so ids stay stable and readable.
  kept.sort((a, b) => b.score - a.score || a.text.length - b.text.length);
  const prompts = kept.slice(0, MAX_PROMPTS).map((p, i) => ({ ...p, id: `p${i + 1}` }));

  const library = {
    prompts,
    source: {
      name: "GokuScraper / seedance-2-prompts-datasets",
      url: SOURCE_URL,
      licenseNote:
        "Prompts collected from public communities by the dataset curator, who disclaims copyright; rights remain with the original authors. Reproduced here as a study set with attribution.",
      consideredRows: considered,
      ingestedAt: new Date().toISOString().slice(0, 10),
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(library, null, 1));

  const byCat = {};
  for (const p of prompts) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  console.log(`Considered   ${considered}`);
  console.log(`  off-brief  ${excluded}`);
  console.log(`  wrong size ${tooShort}`);
  console.log(`  duplicates ${dupes}`);
  console.log(`Passed       ${kept.length}`);
  console.log(`Written      ${prompts.length} -> ${path.relative(process.cwd(), OUT)}`);
  console.log("\nBy category:");
  for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(16)} ${n}`);
  }
}

const args = process.argv.slice(2);
const doInspect = args.includes("--inspect");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/ingest-prompts.mjs [--inspect] <metadata.jsonl>");
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}
await (doInspect ? inspect(file) : build(file));
