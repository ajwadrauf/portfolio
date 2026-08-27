#!/usr/bin/env node
/**
 * Turns the GokuScraper Seedance 2 metadata.jsonl into the studio's prompt
 * library.
 *
 * Sources — a local file, or the dataset server directly:
 *   node scripts/ingest-prompts.mjs --inspect <file>   print the schema it found
 *   node scripts/ingest-prompts.mjs <file>             write the library JSON
 *   node scripts/ingest-prompts.mjs --from-api         page the API, no download
 *   node scripts/ingest-prompts.mjs --from-api --inspect
 *
 * --from-api needs network access to huggingface.co, so it runs on your
 * machine rather than in a sandbox that blocks it. It pages the rows
 * endpoint 100 at a time, which is the cap that endpoint enforces.
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
const DATASET = "GokuScraper/seedance-2-prompts-datasets";
const API = "https://datasets-server.huggingface.co";
/** The rows endpoint refuses more than 100 per call. */
const PAGE = 100;
const SOURCE_URL = "https://huggingface.co/datasets/GokuScraper/seedance-2-prompts-datasets";

// --- field detection -------------------------------------------------------
const KEYS = {
  prompt: [
    "raw_prompt", "raw_p", "prompt_raw", "prompt", "text", "caption",
    "description", "prompt_en", "prompt_text", "content",
  ],
  author: ["author", "user", "username", "creator", "uploader", "nickname", "author_name"],
  url: [
    "url", "source_url", "link", "page_url", "video_url", "share_url", "origin",
    "media.video", "media.url", "media.cover", "media.video_url",
  ],
  aspect: ["aspect_ratio", "aspect", "ratio", "model_info.aspect_ratio"],
  duration: ["duration", "duration_seconds", "seconds", "length", "model_info.duration"],
  /** The dataset's own coarse label — kept alongside my retail categories. */
  sourceCategory: ["category", "tag", "topic"],
  id: ["id", "slug", "uid"],
};

/**
 * Flattens one level of nesting so dotted candidates like "media.video" can
 * be found. The dataset stores model_info and media as dicts, and the useful
 * scalars are inside them.
 */
function flatten(row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = v2;
    }
  }
  return out;
}

/** True when the text is mostly CJK — the rubric is English-only. */
const isCJK = (t) => {
  const cjk = (t.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) || []).length;
  return cjk > t.length * 0.15;
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

/**
 * Pages the dataset server. Each item is {row_idx, row, truncated_cells};
 * the actual record is `.row`, and a truncated cell means the server
 * shortened a long value — those rows are skipped rather than ingested
 * half-complete.
 */
async function* rowsFromApi(split = "train", config = "default") {
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const url =
      `${API}/rows?dataset=${encodeURIComponent(DATASET)}` +
      `&config=${encodeURIComponent(config)}&split=${encodeURIComponent(split)}` +
      `&offset=${offset}&length=${PAGE}`;
    let res;
    try {
      res = await fetch(url);
    } catch (e) {
      // A network-level failure is a different problem from an HTTP error,
      // and the usual cause is a sandbox or corporate proxy refusing the host.
      throw new Error(
        `Could not reach ${API} — ${e instanceof Error ? e.message : e}.\n` +
          "Run this on a machine that can reach huggingface.co, or download\n" +
          "metadata.jsonl and pass it as a file argument instead.",
      );
    }
    if (!res.ok) {
      const hint =
        res.status === 404
          ? `Check the config and split names:\n  curl "${API}/splits?dataset=${encodeURIComponent(DATASET)}"`
          : res.status === 403 || res.status === 407
            ? "That is a network policy refusing the host, not the dataset server.\n" +
              "Run this where huggingface.co is reachable, or download metadata.jsonl\n" +
              "and pass it as a file argument instead."
            : res.status === 429
              ? "Rate limited. Wait a minute and re-run — it resumes from scratch but is cheap."
              : "Try again shortly — the server rebuilds its indexes periodically.";
      throw new Error(`Dataset server returned ${res.status}.\n${hint}`);
    }
    const json = await res.json();
    total = json.num_rows_total ?? json.rows?.length ?? 0;
    if (!json.rows?.length) break;
    for (const item of json.rows) {
      if (item0.truncated_cells?.length) continue;
      if (item0.row) yield item0.row;
    }
    offset += json.rows.length;
    process.stderr.write(`\r  fetched ${Math.min(offset, total)} / ${total}`);
  }
  process.stderr.write("\n");
}

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

async function inspect(source) {
  const counts = new Map();
  let n = 0;
  const samples = [];
  for await (const raw of source) {
    const row = flatten(raw);
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

async function build(source) {
  const seen = new Set();
  const kept = [];
  let considered = 0;
  let excluded = 0;
  let tooShort = 0;
  let dupes = 0;
  let nonEnglish = 0;

  for await (const raw of source) {
    considered++;
    const row = flatten(raw);
    const text = pick(row, KEYS.prompt);
    if (typeof text !== "string") continue;
    // Language first: CJK packs far more meaning per character, so a good
    // Chinese prompt trips the length floor and would be miscounted as a
    // stub. The rubric is English vocabulary and would score it zero anyway;
    // counting it separately keeps the report honest about how much of the
    // corpus this filter simply cannot read.
    if (!includeCjk && isCJK(text)) {
      nonEnglish++;
      continue;
    }
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
    const sourceId = pick(row, KEYS.id);
    kept.push({
      id: `p${kept.length + 1}`,
      sourceId: typeof sourceId === "string" ? sourceId : undefined,
      sourceCategory: pick(row, KEYS.sourceCategory),
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
        "Published under CC BY 4.0 by the dataset curator, which permits reuse with attribution. Every entry keeps its source record id and links back to the dataset.",
      consideredRows: considered,
      ingestedAt: new Date().toISOString().slice(0, 10),
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(library, null, 1));

  const byCat = {};
  for (const p of prompts) byCat[p.category] = (byCat[p.category] ?? 0) + 1;
  console.log(`Considered    ${considered}`);
  console.log(`  off-brief   ${excluded}`);
  console.log(`  wrong size  ${tooShort}`);
  console.log(`  non-English ${nonEnglish}`);
  console.log(`  duplicates  ${dupes}`);
  console.log(`Passed        ${kept.length}`);
  console.log(`Written       ${prompts.length} -> ${path.relative(process.cwd(), OUT)}`);
  console.log("\nBy category:");
  for (const [c, n] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.padEnd(16)} ${n}`);
  }
}

const args = process.argv.slice(2);
const doInspect = args.includes("--inspect");
const fromApi = args.includes("--from-api");
/** The rubric cannot read Chinese; opt in only if you intend to hand-check. */
const includeCjk = args.includes("--include-cjk");
const file = args.find((a) => !a.startsWith("--"));

let source;
if (fromApi) {
  console.error(`Paging ${DATASET} from ${API} …`);
  source = rowsFromApi();
} else if (file) {
  if (!fs.existsSync(file)) {
    console.error(`No such file: ${file}`);
    process.exit(1);
  }
  source = rows(file);
} else {
  console.error(
    "usage:\n" +
      "  node scripts/ingest-prompts.mjs [--inspect] <metadata.jsonl>\n" +
      "  node scripts/ingest-prompts.mjs --from-api [--inspect]\n" +
      "\noptions:\n" +
      "  --include-cjk   keep Chinese prompts (the rubric is English-only)",
  );
  process.exit(1);
}

try {
  await (doInspect ? inspect(source) : build(source));
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
