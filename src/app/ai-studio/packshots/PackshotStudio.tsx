"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveGate } from "@/components/LiveGate";
import { Why } from "@/components/Why";
import { FINISH_OPS, type FinishOp } from "@/lib/recraft.client";
import { useHealth } from "@/lib/useHealth";
import { MODELS, estimateCost } from "@/lib/models";
import {
  EMPTY_BRIEF,
  PACKSHOT_MODELS,
  PACK_ANGLES,
  PACK_VARIABLES,
  briefCompleteness,
  gs1FileName,
  isGrounded,
  resolveSize,
  suggestModel,
  type PackAngle,
  type PackBrief,
} from "@/lib/packshot";

type Reference = { angle: PackAngle; dataUrl: string };

/**
 * Marks a field the studio will happily run without.
 *
 * Worth stating on every one of them rather than assuming it reads as
 * implied: the pack brief is six inputs deep and a form that long looks
 * mandatory. Only two things actually gate a run — one reference photo and one
 * target angle — and both carry the opposite tag.
 */
const Optional = () => (
  <span className="font-normal normal-case tracking-normal text-muted/60">optional</span>
);

const Required = () => (
  <span className="font-normal normal-case tracking-normal text-warning/80">required</span>
);

/**
 * A real pack to start from, so the page is usable without hunting for a
 * product photo first.
 *
 * It is the same pack the video work on this site uses, which makes the two
 * tools read as one studio rather than two demos — and it is deliberately an
 * unbranded pack, because branded packaging is refused by the video model's
 * content filter and the same asset has to serve both.
 */
const EXAMPLE_PACK = {
  url: "https://cd8lfvpdkybjxvfw.public.blob.vercel-storage.com/CookieExample/BakersBest-ChocolateChip-Bag%20Large.png",
  angle: "front" as PackAngle,
  label: "chocolate chip cookie bag, front",
};

type Job = {
  angle: PackAngle;
  modelId: string;
  role: "primary" | "challenger";
  status: "queued" | "running" | "done" | "failed" | "mock";
  imageDataUrl?: string;
  imageUrl?: string;
  prompt?: string;
  grounded?: boolean;
  error?: string;
  cost: number;
  /**
   * The result of a finishing pass, kept beside the original rather than
   * replacing it — a cutout you cannot compare against the render it came
   * from is hard to judge, and the original is still the file some workflows
   * want.
   */
  finished?: { op: FinishOp; url: string };
  finishing?: FinishOp;
  finishError?: string;
};

const SPEND_KEY = "studio-session-spend";
const LANGS = ["enfr", "en", "fr"] as const;

/**
 * Per-reference byte ceiling.
 *
 * References ride the route's JSON body, and a serverless request body is
 * capped at 4.5MB. Six references therefore have to share it, with headroom
 * for the prompt and the rest of the payload — so 600KB each, enforced per
 * file rather than hoped for in aggregate.
 */
const MAX_REF_BYTES = 600 * 1024;

/** Tried in order, largest first, until one fits the budget. */
const REF_TIERS: { maxSide: number; quality: number }[] = [
  { maxSide: 2048, quality: 0.92 },
  { maxSide: 2048, quality: 0.82 },
  { maxSide: 1536, quality: 0.86 },
  { maxSide: 1536, quality: 0.74 },
  { maxSide: 1024, quality: 0.86 },
  { maxSide: 1024, quality: 0.7 },
];

const dataUrlBytes = (u: string) => Math.ceil((u.length - (u.indexOf(",") + 1)) * 0.75);

/**
 * Downscale a reference as little as the payload budget allows.
 *
 * This used to be a flat 1024px at quality 0.92, which is a poor trade for
 * this particular job: the whole promise of the tool is that label text stays
 * legible through an angle change, and the model can only preserve type it
 * could read in the first place. An ingredient list on a 2kg pouch is a few
 * hundred pixels tall in the original and unreadable once the long edge is
 * 1024. Starting at 2048 and stepping down only when the file is genuinely too
 * big keeps the detail on the packs that need it, without risking a body the
 * route cannot accept.
 */
async function toProcessedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    let last = "";
    for (const tier of REF_TIERS) {
      // Never upscale: a 700px photo stays 700px rather than being blown up
      // into detail it does not have.
      const scale = Math.min(1, tier.maxSide / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale) || tier.maxSide;
      canvas.height = Math.round(img.height * scale) || tier.maxSide;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      last = canvas.toDataURL("image/jpeg", tier.quality);
      if (dataUrlBytes(last) <= MAX_REF_BYTES) return last;
    }
    return last;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PackshotStudio() {
  /**
   * Shared with the gate control. This used to derive `live` from keys alone,
   * which reported live on a gated deployment where generation was in fact
   * still returning mocks.
   */
  const { health } = useHealth();
  const [sku, setSku] = useState("");
  const [lang, setLang] = useState<(typeof LANGS)[number]>("enfr");
  const [brief, setBrief] = useState<PackBrief>(EMPTY_BRIEF);
  const [sizePresetId, setSizePresetId] = useState<string | null>(null);
  const [customPx, setCustomPx] = useState<string>("");
  const [references, setReferences] = useState<Reference[]>([]);
  const [uploadAngle, setUploadAngle] = useState<PackAngle>("front");
  const [targets, setTargets] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PACK_ANGLES.map((a) => [a.id, a.id !== "front"])),
  );
  const [modelId, setModelId] = useState<string>("nano-banana-pro");
  const [challengerId, setChallengerId] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sessionSpend, setSessionSpend] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      setSessionSpend(Number(localStorage.getItem(SPEND_KEY) ?? 0));
    } catch {}
  }, []);

  const addSpend = useCallback((amount: number) => {
    setSessionSpend((prev) => {
      const next = Number((prev + amount).toFixed(4));
      try {
        localStorage.setItem(SPEND_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const providedAngles = useMemo(() => references.map((r) => r.angle), [references]);
  const selectedAngles = useMemo(
    () => PACK_ANGLES.filter((a) => targets[a.id]).map((a) => a.id),
    [targets],
  );
  /*
   * Priced against the references actually staged, not against a bare output
   * image. GPT Image 2's edit endpoint bills every reference as high-fidelity
   * input, so a six-reference run costs meaningfully more than its per-image
   * rate — and an estimate that ignores that reads low by exactly the amount
   * the user did not agree to.
   */
  /*
   * Every model in the picker has a different reference ceiling and a
   * different idea of what "resolution" means, so both are derived from the
   * selected model rather than fixed. Where a challenger is set, the binding
   * limit is the stricter of the two — a run that fits the primary and
   * overflows the challenger fails halfway through, having already spent.
   */
  const primary = MODELS[modelId];
  const challenger = challengerId ? MODELS[challengerId] : undefined;
  const sizeSupport = primary.outputSizes;
  const refCap = Math.min(
    primary.maxReferenceImages ?? 16,
    challenger?.maxReferenceImages ?? 16,
  );
  const overCap = references.length > refCap;
  const cappedBy =
    challenger && (challenger.maxReferenceImages ?? 16) < (primary.maxReferenceImages ?? 16)
      ? challenger
      : primary;

  // Reset a preset the newly-chosen model does not publish, rather than
  // sending an id it will not recognise.
  const activePresetId =
    sizeSupport?.presets.some((p) => p.id === sizePresetId)
      ? sizePresetId
      : (sizeSupport?.presets[Math.min(1, sizeSupport.presets.length - 1)]?.id ?? null);
  const customValue = Number(customPx);
  /*
   * Aspect-only models are asked for nothing.
   *
   * `activePresetId` always resolves to something so the control has a
   * selected state, but passing it to a model that takes no size made
   * resolveSize report an adjustment on page load — a warning about a request
   * nobody made. Warn only when the author actually chose.
   */
  const requestedSize =
    sizeSupport?.mode === "aspect" && sizePresetId === null
      ? {}
      : {
          presetId: sizePresetId === "custom" ? undefined : (activePresetId ?? undefined),
          px:
            sizePresetId === "custom" && Number.isFinite(customValue)
              ? customValue
              : undefined,
        };
  const resolved = resolveSize(sizeSupport, requestedSize);

  const { filled, total } = briefCompleteness(brief);
  /*
   * Size is part of the price on two of these models, so it is part of the
   * estimate. Nano Banana Pro steps 1.5x at 2K and 2x at 4K; GPT Image 2 bills
   * by pixel area, which makes a 2048² render four times a 1024² one. Quoting
   * one flat rate per model understated both — the same failure as the video
   * estimate that read $1.57 against a $3.05 invoice.
   */
  const costOpts = {
    referenceImages: references.length,
    sizePresetId: sizePresetId === "custom" ? undefined : (activePresetId ?? undefined),
    sizePx: sizePresetId === "custom" ? resolved.px : undefined,
  };
  const perAngleCost =
    estimateCost(modelId, costOpts) +
    (challengerId ? estimateCost(challengerId, costOpts) : 0);
  const totalEstimate = selectedAngles.length * perAngleCost;
  const groundedCount = selectedAngles.filter((a) => isGrounded(a, providedAngles)).length;

  const addReference = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const dataUrl = await toProcessedDataUrl(file);
        setReferences((prev) => [
          ...prev.filter((r) => r.angle !== uploadAngle),
          { angle: uploadAngle, dataUrl },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that image");
      }
    },
    [uploadAngle],
  );

  /**
   * Pulls the example in and puts it through the same processing a dropped
   * file gets — resized, flattened, re-encoded — so the example behaves
   * exactly like something you uploaded rather than like a special case that
   * works better than real input.
   */
  const [exampleBusy, setExampleBusy] = useState(false);
  const loadExample = useCallback(async () => {
    setError(null);
    setExampleBusy(true);
    try {
      const res = await fetch(EXAMPLE_PACK.url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const dataUrl = await toProcessedDataUrl(
        new File([blob], "example-pack.png", { type: blob.type || "image/png" }),
      );
      setReferences((prev) => [
        ...prev.filter((r) => r.angle !== EXAMPLE_PACK.angle),
        { angle: EXAMPLE_PACK.angle, dataUrl },
      ]);
      setUploadAngle(EXAMPLE_PACK.angle);
    } catch (e) {
      setError(
        `Could not load the example image (${e instanceof Error ? e.message : "unknown"}). It is fetched from storage at click time, so an offline session or a blocked request will stop it — uploading your own photo works either way.`,
      );
    } finally {
      setExampleBusy(false);
    }
  }, []);

  const updateJob = useCallback(
    (angle: PackAngle, jobModelId: string, patch: Partial<Job>) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.angle === angle && j.modelId === jobModelId ? { ...j, ...patch } : j,
        ),
      );
    },
    [],
  );

  /**
   * One angle on one model.
   *
   * Pulled out of the batch loop so a single failure can be retried on its
   * own. Re-running the whole set to recover one angle means paying again for
   * the ones that already worked, which on a seven-angle A/B is thirteen
   * wasted generations to fix one.
   */
  const runOne = useCallback(
    async (angle: PackAngle, jobModelId: string) => {
      updateJob(angle, jobModelId, { status: "running", error: undefined });
      try {
        const res = await fetch("/api/packshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetAngle: angle,
            modelId: jobModelId,
            references,
            brief,
            sizePresetId: sizePresetId === "custom" ? undefined : (activePresetId ?? undefined),
            sizePx: sizePresetId === "custom" ? resolved.px : undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Generation failed");
        if (!json.mock) addSpend(json.cost ?? 0);
        updateJob(angle, jobModelId, {
          status: json.mock ? "mock" : "done",
          imageDataUrl: json.imageDataUrl,
          imageUrl: json.imageUrl,
          prompt: json.prompt,
          grounded: json.grounded,
          cost: json.mock ? 0 : (json.cost ?? 0),
        });
      } catch (e) {
        updateJob(angle, jobModelId, {
          status: "failed",
          error: e instanceof Error ? e.message : "Generation failed",
        });
      }
    },
    [addSpend, activePresetId, brief, references, resolved.px, sizePresetId, updateJob],
  );

  /*
   * Advice about the current setup, not about models in general. It only
   * appears when the pick is actually a poor fit for the angles selected, so
   * it stays worth reading.
   */
  const suggestion = suggestModel({
    modelId,
    targets: selectedAngles,
    provided: providedAngles,
    maxReferenceImages: primary.maxReferenceImages ?? 16,
  });

  /**
   * Run a Recraft finishing pass over a result that already exists.
   *
   * Kept out of the model picker on purpose: these are not another way to
   * generate a packshot, they are what turns one into a usable asset, and they
   * cost a fraction of a render.
   */
  const finish = useCallback(
    async (job: Job, op: FinishOp) => {
      const source = job.finished?.url ?? job.imageUrl ?? job.imageDataUrl;
      if (!source) return;
      updateJob(job.angle, job.modelId, { finishing: op, finishError: undefined });
      try {
        const res = await fetch("/api/packshot/finish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op, imageUrl: source }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Finishing failed");
        addSpend(json.cost ?? 0);
        updateJob(job.angle, job.modelId, {
          finishing: undefined,
          finished: { op, url: json.url },
        });
      } catch (e) {
        updateJob(job.angle, job.modelId, {
          finishing: undefined,
          finishError: e instanceof Error ? e.message : "Finishing failed",
        });
      }
    },
    [addSpend, updateJob],
  );

  const done = jobs.filter((j) => j.imageDataUrl || j.imageUrl);
  const failed = jobs.filter((j) => j.status === "failed");
  const needsQA = done.filter((j) => j.grounded === false);

  const retryFailed = useCallback(async () => {
    // Two at a time, matching the batch loop — the providers rate-limit and a
    // retry storm is how a recoverable failure becomes a permanent one.
    const queue = [...failed];
    const worker = async () => {
      for (;;) {
        const j = queue.shift();
        if (!j) return;
        await runOne(j.angle, j.modelId);
      }
    };
    await Promise.all([worker(), worker()]);
  }, [failed, runOne]);

  /**
   * Save the whole set.
   *
   * A planogram delivery is a set, not seven separate files, and clicking
   * seven links is where the GS1 naming stops being worth having. Sequential
   * with a gap because browsers throttle rapid programmatic downloads and
   * silently drop the ones that arrive too fast.
   */
  const downloadAll = useCallback(async () => {
    for (const j of done) {
      const gs1 = gs1FileName(sku, lang, j.angle);
      const name =
        j.role === "challenger" ? gs1.replace(/\.jpg$/, `__${j.modelId}.jpg`) : gs1;
      const a = document.createElement("a");
      a.href = downloadHref(j, name);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 350));
    }
  }, [done, lang, sku]);

  const generate = useCallback(async () => {
    if (references.length === 0 || selectedAngles.length === 0) return;
    // Refused here as well as server-side: over the cap the run would fail
    // partway, after the confirm dialog and after spending on the angles that
    // happened to go first.
    if (overCap) return;
    setError(null);
    const runs: { angle: PackAngle; modelId: string; role: "primary" | "challenger" }[] =
      selectedAngles.flatMap((angle) => [
        { angle, modelId, role: "primary" as const },
        ...(challengerId
          ? [{ angle, modelId: challengerId, role: "challenger" as const }]
          : []),
      ]);
    if (health?.live) {
      const ok = window.confirm(
        `This will run ${runs.length} live packshot generation${runs.length === 1 ? "" : "s"}${challengerId ? " (A/B: primary + challenger per angle)" : ""} at an estimated cost of $${totalEstimate.toFixed(2)}. Proceed?`,
      );
      if (!ok) return;
    }
    setJobs(runs.map((r) => ({ ...r, status: "queued", cost: 0 })));

    const queue = [...runs];
    const worker = async () => {
      for (;;) {
        const run = queue.shift();
        if (!run) return;
        await runOne(run.angle, run.modelId);
      }
    };
    await Promise.all([worker(), worker()]);
  }, [challengerId, health, modelId, overCap, references.length, runOne, selectedAngles, totalEstimate]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10">
      {/* status */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.gemini ? "bg-success" : "bg-muted/50"}`} />
            Gemini API {health?.gemini ? "connected" : "not configured"}
          </span>
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.fal ? "bg-success" : "bg-muted/50"}`} />
            fal.ai {health?.fal ? "connected" : "not configured"}
          </span>
          {/*
            Recraft is a third provider with its own key, and this is the only
            studio that offers a Recraft model — so the chip lives here rather
            than in the shared status bars, where it would report on a key
            nothing on the page could spend.
          */}
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.recraft ? "bg-success" : "bg-muted/50"}`} />
            Recraft {health?.recraft ? "connected" : "not configured"}
          </span>
          {/* Live-mode state sits with the other connection chips, not in the nav. */}
          <LiveGate />
          {health && !health.live && !health.gemini && !health.fal && !health.recraft && (
            <span className="chip border-warning/40 text-warning">
              Demo mode — zero-cost mocks; add API keys to go live
            </span>
          )}
        </div>
        <span className="chip">Session spend: ${sessionSpend.toFixed(2)}</span>
      </div>

      <h1 className="mt-6 text-[1.75rem] tracking-[-0.03em]">Packshot Studio</h1>
      <p className="mt-2 max-w-3xl text-muted">
        The planogram case: every SKU needs product-on-white at up to 7 angles.
        Upload the reference photos you already have, and generate the missing
        GS1 angles instead of re-shooting them. Angles backed by a real
        reference are marked <span className="font-semibold text-success">grounded</span>;
        angles the camera never saw are{" "}
        <span className="font-semibold text-warning">reconstructed</span> and
        flagged for mandatory label QA — the model can&apos;t know what an unseen
        face of the package says.
      </p>

      {error && (
        <div className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      )}

      {/*
        Intake runs the full width rather than down a 380px rail.
        
        The brief is six fields plus a reference grid plus two model pickers
        and a size control; in a narrow column all of that stacked into a long
        scroll, and the pack variables in particular read as a wall of inputs
        rather than as six related facts about one object. Across the page they
        sit two and three abreast, and the whole intake is visible at once —
        which is what makes it obvious that most of it is blank.
      */}
      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="contents">
          <div className="card p-5 lg:col-span-4">
            <h2 className="font-semibold">1 · Product</h2>
            <label className="mt-3 block">
              <span className="mb-1 flex items-baseline justify-between gap-2 label">
                <span>SKU / GTIN</span>
                <Optional />
              </span>
              <input
                className="input"
                placeholder="6565170002"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
              <span className="mt-1 block text-[11px] leading-[1.5] text-muted/80">
                Names the downloads in GS1 planogram form. Left blank they are
                named SKU_… and can be renamed later.
              </span>
            </label>
            <label className="mt-3 block">
              <span className="mb-1 flex items-baseline justify-between gap-2 label">
                <span>Language code</span>
                <Optional />
              </span>
              <select
                className="input"
                value={lang}
                onChange={(e) => setLang(e.target.value as (typeof LANGS)[number])}
              >
                {LANGS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </label>
          </div>

          {/*
            The variables.
            
            A front photo carries the label and roughly the silhouette. It
            carries nothing about volume, material or how the pack holds its
            shape — and those are what every unphotographed angle is a guess
            about. Six one-line fields turn the guess into a reconstruction,
            which is the whole difference between a usable planogram asset and
            a plausible picture.
          */}
          <div className="card p-5 lg:col-span-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">2 · What the pack is</h2>
              <span
                className={`chip shrink-0 ${filled === 0 ? "!border-warning/50 !text-warning" : filled === total ? "!border-success/50 !text-success" : ""}`}
              >
                {filled}/{total} set
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              All of this is optional — nothing here blocks a run. It matters
              in proportion to how much you are asking the model to invent: for
              an angle your photos already show, skip it; for a face no photo
              shows, it is doing most of the work. A photo of the front tells
              the model what the label says, not what the object is.
            </p>

            {/*
              Three abreast on a wide screen. The reason each field exists is
              worth reading once and then never again, so it shows under an
              empty field and gets out of the way as soon as it is answered.
            */}
            <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {PACK_VARIABLES.map((v) => (
                <label key={v.id} className="block" title={v.why}>
                  <span className="mb-1 flex items-baseline justify-between gap-2 label">
                    <span>{v.label}</span>
                    <Optional />
                  </span>
                  <input
                    className="input"
                    list={v.options ? `pack-${v.id}` : undefined}
                    placeholder={v.placeholder}
                    value={brief[v.id]}
                    onChange={(e) => setBrief((b) => ({ ...b, [v.id]: e.target.value }))}
                  />
                  {v.options && (
                    <datalist id={`pack-${v.id}`}>
                      {v.options.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  )}
                  {!brief[v.id].trim() && (
                    <span className="mt-1 block text-[11px] leading-[1.5] text-muted/80">
                      {v.why}
                    </span>
                  )}
                </label>
              ))}

              <label className="block sm:col-span-2 xl:col-span-3">
                <span className="mb-1 flex items-baseline justify-between gap-2 label">
                  <span>Anything else</span>
                  <Optional />
                </span>
                <input
                  className="input"
                  placeholder="e.g. the window panel is on the front only, or the cap is a different plastic"
                  value={brief.notes}
                  onChange={(e) => setBrief((b) => ({ ...b, notes: e.target.value }))}
                />
              </label>
            </div>

            {filled < 3 && (
              <p className="mt-3 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed">
                <span className="font-bold text-warning">Thin brief.</span>{" "}
                With this little to go on the model will render a rigid box with
                a gloss finish, because that is the average of everything it has
                seen. Format, material and dimensions are the three that change
                the result most.
              </p>
            )}
          </div>

          <div className="card p-5 lg:col-span-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">3 · Reference photos</h2>
              <span className="label"><Required /></span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Every face you add turns a reconstruction into a grounded angle.
            </p>

            {/*
              Model-specific, and next to the upload control rather than beside
              the model picker.
              
              This is where the decision gets made — how many photos to go and
              find, and which ones. The ceilings differ by an order of
              magnitude across this list and so does the right way to spend
              them, so a single generic "add every face you have" was good
              advice for two of the six models and wrong for the rest.
            */}
            <div
              className={`mt-3 rounded-[6px] border p-3 ${
                overCap
                  ? "border-danger/40 bg-danger/10"
                  : "border-accent/30 bg-accent/[0.04]"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="label !text-accent">
                  {cappedBy.label.split(" (")[0]}
                </span>
                <span
                  className={`font-mono text-[11px] ${overCap ? "text-danger" : "text-muted"}`}
                >
                  {references.length}/{refCap} used
                </span>
              </div>
              {overCap ? (
                <p className="mt-1.5 text-xs leading-relaxed">
                  <span className="font-bold text-danger">Too many references.</span>{" "}
                  {cappedBy.label} accepts {refCap}. Remove{" "}
                  {references.length - refCap} before running, or pick a model
                  with a higher ceiling — the run is refused rather than
                  silently dropping the extras, because a dropped face turns a
                  grounded angle into a reconstruction without saying so.
                </p>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">
                    Supports {refCap} reference{refCap === 1 ? "" : "s"}.
                  </span>{" "}
                  {cappedBy.referenceGuidance}
                </p>
              )}
              {challenger &&
                (challenger.maxReferenceImages ?? 16) !==
                  (primary.maxReferenceImages ?? 16) && (
                  <p className="mt-2 border-t border-border-soft pt-2 text-[11px] leading-relaxed text-muted">
                    The A/B is held to the stricter of the two —{" "}
                    {primary.label.split(" (")[0]} takes{" "}
                    {primary.maxReferenceImages}, {challenger.label.split(" (")[0]}{" "}
                    takes {challenger.maxReferenceImages}.
                  </p>
                )}
            </div>

            <div className="mt-3 flex gap-2">
              <select
                className="input flex-1"
                value={uploadAngle}
                onChange={(e) => setUploadAngle(e.target.value as PackAngle)}
              >
                {PACK_ANGLES.filter((a) => a.id !== "hero34").map((a) => (
                  <option key={a.id} value={a.id}>{a.label}</option>
                ))}
              </select>
              <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
                Add photo
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void addReference(f);
                  e.target.value = "";
                }}
              />
            </div>

            {/*
              Sits under the upload row rather than beside it: adding your own
              photo is the primary action, and the example is the way in for
              someone who arrived without one.
            */}
            <button
              className="mt-2.5 text-xs font-semibold text-accent hover:underline disabled:opacity-50"
              onClick={() => void loadExample()}
              disabled={exampleBusy}
            >
              {exampleBusy ? "Loading the example…" : "or load an example pack →"}
            </button>

            {references.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {references.map((r) => (
                  <div key={r.angle} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.dataUrl}
                      alt={r.angle}
                      className="aspect-square w-full rounded-[6px] border border-border-soft object-cover"
                    />
                    <span className="absolute left-1 top-1 rounded bg-foreground/80 px-1.5 py-0.5 text-[10px] font-semibold text-background">
                      {r.angle}
                    </span>
                    <button
                      className="absolute right-1 top-1 rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white"
                      onClick={() =>
                        setReferences((prev) => prev.filter((x) => x.angle !== r.angle))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-5 lg:col-span-7">
            <h2 className="font-semibold">4 · Model and output size</h2>
            <label className="mt-3 block">
              <span className="mb-1 block label">
                Primary
              </span>
              <select
                className="input"
                value={modelId}
                onChange={(e) => {
                setModelId(e.target.value);
                // A size chosen for one model means nothing on the next.
                setSizePresetId(null);
                setCustomPx("");
              }}
              >
                {PACKSHOT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {MODELS[m].label} —{" "}
                    {(MODELS[m].outputSizes?.presets ?? []).some(
                      (x) => (x.costMultiplier ?? 1) !== 1,
                    )
                      ? `from $${MODELS[m].unitCost}/img`
                      : `$${MODELS[m].unitCost}/img`}
                    {MODELS[m].refImageCost
                      ? ` + $${MODELS[m].refImageCost} per reference`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block label">
                Challenger (A/B, optional)
              </span>
              <select
                className="input"
                value={challengerId}
                onChange={(e) => setChallengerId(e.target.value)}
              >
                <option value="">Off — primary only</option>
                {PACKSHOT_MODELS.filter((m) => m !== modelId).map((m) => (
                  <option key={m} value={m}>
                    {MODELS[m].label} —{" "}
                    {(MODELS[m].outputSizes?.presets ?? []).some(
                      (x) => (x.costMultiplier ?? 1) !== 1,
                    )
                      ? `from $${MODELS[m].unitCost}/img`
                      : `$${MODELS[m].unitCost}/img`}
                    {MODELS[m].refImageCost
                      ? ` + $${MODELS[m].refImageCost} per reference`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            {suggestion && (
              <div
                className={`mt-3 rounded-[6px] border p-3 ${
                  suggestion.severity === "warn"
                    ? "border-warning/40 bg-warning/10"
                    : "border-accent/30 bg-accent/[0.04]"
                }`}
              >
                <p className="text-xs leading-relaxed">
                  <span
                    className={`font-bold ${suggestion.severity === "warn" ? "text-warning" : "text-accent"}`}
                  >
                    {suggestion.severity === "warn"
                      ? "Wrong tool for this run."
                      : "Cheaper route available."}
                  </span>{" "}
                  {suggestion.text}
                </p>
                {suggestion.suggest && PACKSHOT_MODELS.includes(suggestion.suggest) && (
                  <button
                    className="mt-2 text-xs font-semibold text-accent hover:underline"
                    onClick={() => {
                      setModelId(suggestion.suggest!);
                      setSizePresetId(null);
                      setCustomPx("");
                    }}
                  >
                    Switch to {MODELS[suggestion.suggest].label.split(" (")[0]} →
                  </button>
                )}
              </div>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted">
              <span className="font-semibold text-foreground">Picking one:</span>{" "}
              Nano Banana Pro holds label text best and reads the most
              references, so it is the default for angles you have to
              reconstruct. GPT Image 2 follows a written brief most literally.
              Seedream is the value benchmark and the only one where 4K is free.
              Recraft&apos;s two tiers restage a single photo rather than
              synthesising an angle — draft on Utility, finish on Utility Pro.
              With a challenger set, every angle runs on both models side by
              side: the bake-off that should decide your default.
            </p>


            {/* Output size, per model. */}
            {sizeSupport && (
              <div className="mt-4 border-t border-border-soft pt-4">
                <span className="label">Output size</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizeSupport.presets.map((preset) => {
                    const active =
                      sizePresetId !== "custom" && activePresetId === preset.id;
                    // Priced per tier, on the button, because on two of these
                    // models the tier is most of the decision.
                    const each = estimateCost(modelId, {
                      referenceImages: references.length,
                      sizePresetId: preset.id,
                    });
                    return (
                      <button
                        key={preset.id}
                        title={preset.note}
                        onClick={() => setSizePresetId(preset.id)}
                        className={`rounded-[6px] border px-3 py-1.5 text-left text-xs font-semibold transition ${
                          active
                            ? "border-accent bg-accent/[0.05] text-accent"
                            : "border-border-soft bg-surface hover:border-accent/40"
                        }`}
                      >
                        {preset.label}
                        <span
                          className={`ml-2 font-mono font-normal ${active ? "text-accent/80" : "text-muted"}`}
                        >
                          ${each.toFixed(3)}
                        </span>
                      </button>
                    );
                  })}
                  {sizeSupport.custom && (
                    <button
                      onClick={() => setSizePresetId("custom")}
                      className={`rounded-[6px] border px-3 py-1.5 text-xs font-semibold transition ${
                        sizePresetId === "custom"
                          ? "border-accent bg-accent/[0.05] text-accent"
                          : "border-border-soft bg-surface hover:border-accent/40"
                      }`}
                    >
                      Custom
                    </button>
                  )}
                </div>

                {sizePresetId === "custom" && sizeSupport.custom && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      className="input !w-28"
                      inputMode="numeric"
                      aria-label="Custom size in pixels"
                      placeholder={String(sizeSupport.custom.min)}
                      value={customPx}
                      onChange={(e) => setCustomPx(e.target.value)}
                    />
                    <span className="text-xs text-muted">
                      px square · {sizeSupport.custom.min}–{sizeSupport.custom.max},
                      in steps of {sizeSupport.custom.multipleOf}
                      {resolved.px && (
                        <>
                          {" · "}
                          <span className="font-mono text-foreground">
                            ${estimateCost(modelId, costOpts).toFixed(3)}
                          </span>{" "}
                          per angle
                        </>
                      )}
                    </span>
                  </div>
                )}

                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {sizeSupport.note}
                </p>
                {sizeSupport.presets.length > 1 &&
                  sizeSupport.presets.every((x) => (x.costMultiplier ?? 1) === 1) && (
                    <p className="mt-1.5 text-xs leading-relaxed text-success">
                      Size does not change the price on this model — take the
                      largest tier that renders.
                    </p>
                  )}
                {resolved.note && (
                  <p className="mt-2 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed">
                    <span className="font-bold text-warning">Adjusted.</span>{" "}
                    {resolved.note}
                  </p>
                )}
                {challenger?.outputSizes &&
                  challenger.outputSizes.mode !== sizeSupport.mode && (
                    <p className="mt-2 text-xs leading-relaxed text-muted">
                      <span className="font-semibold text-foreground">
                        The challenger sizes differently.
                      </span>{" "}
                      {challenger.label}: {challenger.outputSizes.note} A/B
                      results will not be pixel-matched.
                    </p>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* targets + results, full width beneath the intake */}
        <div className="lg:col-span-12">
          <div className="card p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">5 · Target angles</h2>
              <span className="label"><Required /></span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PACK_ANGLES.map((a) => {
                const grounded = isGrounded(a.id, providedAngles);
                return (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-[6px] border border-border-soft bg-surface px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={targets[a.id]}
                        onChange={(e) =>
                          setTargets((prev) => ({ ...prev, [a.id]: e.target.checked }))
                        }
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <span className="text-sm font-medium">{a.label}</span>
                    </span>
                    <span
                      className={`chip ${grounded ? "border-success/40 text-success" : "border-warning/40 text-warning"}`}
                    >
                      {grounded ? "grounded" : "reconstructed"}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
              <div className="text-sm text-muted">
                {selectedAngles.length} angle{selectedAngles.length === 1 ? "" : "s"} ·{" "}
                {groundedCount} grounded ·{" "}
                <span className="font-bold text-accent">~${totalEstimate.toFixed(2)}</span>
                {health && !health.live && (
                  <span className="ml-2 text-xs text-warning">(demo mode — $0)</span>
                )}
              </div>
              <button
                className="btn-primary"
                disabled={references.length === 0 || selectedAngles.length === 0 || overCap}
                onClick={() => void generate()}
              >
                Generate packshots →
              </button>
            </div>
            {references.length === 0 && (
              <p className="mt-2 text-xs text-muted">
                Add at least one reference photo to enable generation.
              </p>
            )}
          </div>

          {jobs.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-5">
              <div className="text-sm">
                <span className="label">Results</span>
                <span className="ml-3 text-muted">
                  {done.length} of {jobs.length} done
                  {failed.length > 0 && (
                    <span className="text-danger"> · {failed.length} failed</span>
                  )}
                  {needsQA.length > 0 && (
                    <span className="text-warning">
                      {" "}
                      · {needsQA.length} needing label QA
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {failed.length > 0 && (
                  <button
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => void retryFailed()}
                  >
                    Retry {failed.length} failed
                  </button>
                )}
                {done.length > 1 && (
                  <button
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => void downloadAll()}
                  >
                    Download all {done.length}
                  </button>
                )}
              </div>
            </div>
          )}

          {jobs.length > 0 && (
            <div
              /*
                Wider now that results are not sharing the row with a rail.
                With a challenger set the column count stays even, so each
                angle's two renders land side by side rather than wrapping
                apart — comparing them is the entire point of the A/B.
              */
              className={`mt-6 grid gap-4 ${
                challengerId
                  ? "sm:grid-cols-2 xl:grid-cols-4"
                  : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }`}
            >
              {jobs.map((j) => (
                <PackshotCard
                  key={`${j.angle}:${j.modelId}`}
                  job={j}
                  sku={sku}
                  lang={lang}
                  onRetry={() => void runOne(j.angle, j.modelId)}
                  onFinish={(op) => void finish(j, op)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Where the Download link points.
 *
 * A data URL saves directly. A hosted one goes through our own origin, because
 * the `download` attribute is ignored cross-origin — without the proxy the
 * browser navigates to the image and the GS1 filename is lost, which on a
 * planogram asset is the part that matters.
 */
function downloadHref(job: Job, fileName: string): string {
  if (job.imageDataUrl) return job.imageDataUrl;
  return `/api/packshot-file?url=${encodeURIComponent(job.imageUrl ?? "")}&name=${encodeURIComponent(fileName)}`;
}

function PackshotCard({
  job,
  sku,
  lang,
  onRetry,
  onFinish,
}: {
  job: Job;
  sku: string;
  lang: string;
  onRetry?: () => void;
  onFinish?: (op: FinishOp) => void;
}) {
  const spec = PACK_ANGLES.find((a) => a.id === job.angle)!;
  const model = MODELS[job.modelId];
  const [showPrompt, setShowPrompt] = useState(false);
  const gs1 = gs1FileName(sku, lang, job.angle);
  const fileName =
    job.role === "challenger" ? gs1.replace(/\.jpg$/, `__${job.modelId}.jpg`) : gs1;
  const media = job.imageDataUrl ?? job.imageUrl;

  return (
    <div className="card overflow-hidden">
      <div className="relative aspect-square w-full bg-surface-2">
        {media ? (
          // eslint-disable-next-line @next/next/no-img-element
          /*
            Contain, not cover.
            
            Not every model returns a square: Flash Image picks its own pixel
            count, and cover silently crops the product out of
            the preview. On a planogram asset that is the worst kind of
            wrong — the thumbnail looks fine, so the crop is only discovered
            after the file is in someone's hands.
          */
          <img
            src={media}
            alt={spec.label}
            className="absolute inset-0 h-full w-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
            {job.status === "failed" ? (
              <p className="max-w-[80%] text-center text-danger">{job.error}</p>
            ) : (
              <>
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
                <p>{job.status === "queued" ? "Queued" : "Generating…"}</p>
              </>
            )}
          </div>
        )}
        {job.status === "mock" && (
          <span className="absolute left-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
            DEMO
          </span>
        )}
        {job.grounded === false && (
          <span className="absolute right-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
            LABEL QA REQUIRED
          </span>
        )}
      </div>
      {job.finished && (
        /*
          Transparency is invisible against any solid colour, so the cutout
          sits on a checkerboard. Without it a successful background removal
          and a failed one look identical on a white card.
        */
        <div className="border-t border-border-soft bg-[length:16px_16px] bg-[linear-gradient(45deg,rgba(128,128,128,0.18)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.18)_75%),linear-gradient(45deg,rgba(128,128,128,0.18)_25%,transparent_25%,transparent_75%,rgba(128,128,128,0.18)_75%)] bg-[position:0_0,8px_8px]">
          <div className="relative aspect-square w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.finished.url}
              alt={`${spec.label}, ${FINISH_OPS[job.finished.op].label.toLowerCase()}`}
              className="absolute inset-0 h-full w-full object-contain"
            />
            <span className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-[10px] font-bold text-background">
              {FINISH_OPS[job.finished.op].label.toUpperCase()}
            </span>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{spec.label}</p>
          <span className="flex items-center gap-1">
            {job.role === "challenger" && (
              <span className="chip border-accent/40 text-accent">challenger</span>
            )}
            {job.cost > 0 && <span className="chip">${job.cost.toFixed(2)}</span>}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{model.label}</p>
        <p className="mt-1 break-all font-mono text-[11px] text-muted">{fileName}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          {media && (
            <a
              href={downloadHref(job, fileName)}
              download={fileName}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Download{job.finished ? " original" : ""}
            </a>
          )}
          {job.finished && (
            <a
              href={`/api/packshot-file?url=${encodeURIComponent(job.finished.url)}&name=${encodeURIComponent(fileName.replace(/\.jpg$/, `_${job.finished.op}`))}`}
              download
              className="text-xs font-semibold text-accent hover:underline"
            >
              Download {FINISH_OPS[job.finished.op].label.toLowerCase()}
            </a>
          )}
          {job.status === "failed" && onRetry && (
            <button
              className="text-xs font-semibold text-accent hover:underline"
              onClick={onRetry}
            >
              Retry this angle
            </button>
          )}
          {job.prompt && (
            <button
              className="text-xs font-semibold text-muted hover:text-foreground"
              onClick={() => setShowPrompt((v) => !v)}
            >
              {showPrompt ? "Hide prompt" : "View prompt"}
            </button>
          )}
        </div>

        {/*
          Finishing.
          
          Only offered once there is something to finish, and each action
          carries the case for itself — these are the two steps most likely to
          be skipped precisely because nobody explains why they matter.
        */}
        {media && onFinish && (
          <div className="mt-3 border-t border-border-soft pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {(Object.values(FINISH_OPS) as (typeof FINISH_OPS)[FinishOp][]).map((op) => {
                const isCurrent = job.finished?.op === op.id;
                const busy = job.finishing === op.id;
                return (
                  <span key={op.id} className="inline-flex items-center gap-1.5">
                    <button
                      disabled={!!job.finishing || isCurrent}
                      onClick={() => onFinish(op.id)}
                      className="text-xs font-semibold text-accent hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
                    >
                      {busy
                        ? `${op.label}…`
                        : isCurrent
                          ? `${op.label} ✓`
                          : `${op.label} · $${op.cost}`}
                    </button>
                    <Why title={op.label} align="right">
                      {op.why}
                    </Why>
                  </span>
                );
              })}
            </div>
            {job.finishError && (
              <p className="mt-2 text-[11px] leading-relaxed text-danger">
                {job.finishError}
              </p>
            )}
          </div>
        )}
        {showPrompt && job.prompt && (
          <p className="mt-2 rounded-[6px] bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted">
            {job.prompt}
          </p>
        )}
      </div>
    </div>
  );
}
