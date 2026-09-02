"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveGate } from "@/components/LiveGate";
import { requestLiveUnlock, useHealth } from "@/lib/useHealth";
import {
  AD_NEGATIVE_PROMPT,
  AD_PRESETS,
  CUSTOM_PRESET_ID,
  AD_VIDEO_MODELS,
  AUDIO_REF_LIMITS,
  MULTI_REF_MODELS,
  REFERENCE_ROLES,
  REF_CEILINGS,
  audioCapability,
  referenceMediaOf,
  referenceMediaOfUrl,
  editableRecipeOf,
  getAdPreset,
  isDefaultRecipe,
  maxAdSeconds,
  recipeStatus,
  unmetCriticalSteps,
  VIDEO_REF_LIMITS,
  type AudioMode,
  type EditableRecipe,
  type ReferenceMedia,
  type ReferenceRole,
  type ReferenceSpec,
} from "@/lib/adPresets";
import {
  MUSIC_HANDLE_SECONDS,
  MUSIC_MODEL_ID,
  MUSIC_STYLES,
  NO_MUSIC_ID,
  SYNC_CAVEATS,
  TIMING_REF_NOTES,
  musicLengthFor,
} from "@/lib/music";
import { MODELS, estimateCost, usesTokenPricing } from "@/lib/models";
import {
  MAX_PROMPT_FILE_BYTES,
  PROMPT_FILE_ACCEPT,
  importPrompt,
  isPromptFile,
  refSlots,
} from "@/lib/promptImport";
import { REFERENCE_CLIPS } from "@/lib/referenceClips";
import type { RefFinding } from "@/lib/refCheck";
import { BLENDER_EXAMPLE } from "@/lib/blenderExample";
import {
  ASPECTS,
  VIDEO_RESOLUTIONS,
  resolutionsFor,
  aspectRatioValue,
  aspectsFor,
  frameSize,
  videoToVideoRatio,
  type VideoResolution,
} from "@/lib/videoCost";
import {
  LAYER_NOTES,
  SFX_LIMITS,
  SFX_MODEL_ID,
  SFX_PROMPT_TIPS,
  clampSfxSeconds,
} from "@/lib/sfx";

type Phase = "idle" | "composing" | "ready" | "starting" | "polling" | "done" | "failed" | "mock";

/**
 * Where the prompt comes from.
 *
 * The recipe lane is the lab as designed: a concept preset, product fields and
 * a composed prompt. The Blender lane is for work where the prompt already
 * exists because the shot was blocked out in 3D first — the clay pass has
 * already settled camera, timing and blocking, so a concept preset would only
 * fight it, and the product fields would compose a prompt nobody is going to
 * use. Those three steps are not hidden to tidy the page up; they are hidden
 * because running them would produce the wrong prompt.
 */
type Lane = "recipe" | "blender";

/**
 * Everything needed to ask "is it done yet?" about a render that has already
 * been paid for. The status endpoint is stateless — given this handle it can
 * fetch the result at any point — so the only way a paid render becomes
 * unrecoverable is if we throw the handle away. We used to. It lived in a
 * closure, so a timeout, a reload or a closed tab lost the video while fal
 * finished it anyway.
 */
type PendingJob = {
  provider: "gemini" | "fal";
  operationName?: string;
  falRequestId?: string;
  modelId: string;
  /** Shown back to the user so a long render reads as long, not stuck. */
  startedAt: number;
  /** For the resume prompt, so it says what is waiting rather than "a job". */
  label: string;
  aspect: string;
};

/**
 * A pre-addressed request for an access code.
 *
 * Encoded once, at module scope: the subject and body are constants, and a
 * mailto with a raw newline or an unencoded ampersand in it silently loses
 * everything after the offending character in some mail clients.
 */
const ACCESS_REQUEST_MAILTO = `mailto:hello@ajwadrauf.com?subject=${encodeURIComponent(
  "Access code request — AI Content Studio",
)}&body=${encodeURIComponent(
  [
    "Hi Ajwad,",
    "",
    "I was trying the Ad Lab on ajwadrauf.com and would like to run a live generation rather than a demo one. Could you send me an access code?",
    "",
    "Name:",
    "Company:",
    "What I am hoping to try:",
    "",
    "Thanks,",
  ].join("\n"),
)}`;

const SPEND_KEY = "studio-session-spend";
const JOB_KEY = "adlab-pending-job";

/** "12 minutes ago" — a render that reads as recent is worth waiting on. */
function relativeTime(then: number) {
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}
const POLL_INTERVAL_MS = 12_000;

/*
 * Render-time landmarks, taken from a measured run rather than a guess: a 12s
 * 4:3 reference render at 480p came back in 447 seconds and cost $3.05.
 *
 * The point of showing these is that a seven-minute wait with a bare spinner
 * is indistinguishable from a hung request, and the natural response to that
 * is to reload — which, before the job handle was persisted, threw the render
 * away. Naming what is normal keeps someone from acting on a wait that is
 * going fine.
 */
const TYPICAL_RENDER_MS = 450_000;
/** Past here it is nearly always in its last stretch. */
const ALMOST_READY_MS = 350_000;
/** Past here something is more likely wrong than slow. */
const OVERDUE_MS = 500_000;

/** A pre-addressed report for a render that has run long. */
const STUCK_RENDER_MAILTO = `mailto:hello@ajwadrauf.com?subject=${encodeURIComponent(
  "Long-running render — AI Content Studio",
)}&body=${encodeURIComponent(
  [
    "Hi Ajwad,",
    "",
    "A render in the Ad Lab has been going for longer than the expected few minutes and may be stuck.",
    "",
    "What I was generating:",
    "Roughly when I started it:",
    "",
    "Thanks,",
  ].join("\n"),
)}`;

/** "6m 12s" — a wait reads better in the units people count it in. */
function elapsedLabel(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
}
const POLL_DEADLINE_MS = 10 * 60 * 1000;
const ASPECT_CLASS: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "3:4": "aspect-[3/4]",
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-[16/9]",
  "21:9": "aspect-[21/9]",
};

const REF_ACCEPT =
  "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav,audio/mp4,audio/aac";

const toLines = (xs: string[]) => xs.join("\n");
const fromLines = (v: string) =>
  v.split("\n").map((x) => x.trim()).filter(Boolean);

async function toProcessedDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read that image"));
      el.src = url;
    });
    const maxSide = 1024;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale) || maxSide;
    canvas.height = Math.round(img.height * scale) || maxSide;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A starter clip that plays itself while it is on screen.
 *
 * Hover was the wrong trigger twice over: a motion reference is unreadable as
 * a frozen frame, so the thing being chosen was invisible until touched, and
 * hover does not exist on a phone at all. Playing in view fixes both. The
 * observer matters as much as the autoplay — four clips is tens of megabytes,
 * and nobody scrolled to the References step should pay for it on arrival.
 */
function ClipPreview({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.preload = "auto";
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      className="h-full w-full object-cover"
    />
  );
}

/** One numbered card in the single-column flow. */
function Step({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-semibold">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 font-mono text-[11px] text-accent">
            {n}
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function AdLab({
  availableClipIds = [],
  /** Resolved source per clip id — a hosted URL or a repo path. */
  clipSources = {},
}: {
  availableClipIds?: string[];
  clipSources?: Record<string, string>;
}) {
  /**
   * Shared with the gate control, so unlocking live mode updates this page
   * immediately instead of leaving it convinced it is still in demo mode.
   */
  const { health } = useHealth();
  const [presetId, setPresetId] = useState<string>(AD_PRESETS[0].id);
  const [params, setParams] = useState<Record<string, string>>({});
  const [productImage, setProductImage] = useState<string | null>(null);
  /**
   * Reference-to-video is the default because it is the thing this lab is
   * for: holding a real product still while the camera moves. Landing on a
   * first-frame model means the References step is hidden and the reference
   * recipes have nothing to attach to, which teaches the wrong lesson before
   * anyone has clicked anything.
   */
  const [modelId, setModelId] = useState<string>("seedance-2.5-ref");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * A render that has been started and paid for but not yet collected. Held in
   * state so the timeout screen can offer to check again, and mirrored to
   * localStorage so closing the tab does not throw the money away.
   */
  const [pendingJob, setPendingJob] = useState<PendingJob | null>(null);
  const [checking, setChecking] = useState(false);
  /** The "find a render I already paid for" panel. */
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [pastedId, setPastedId] = useState("");
  const [recent, setRecent] = useState<
    | {
        requestId: string;
        endpoint: string;
        status: string;
        endedAt?: string;
        videoUrl?: string;
      }[]
    | null
  >(null);
  /** True when the prompt arrived from the library rather than the recipe. */
  const [imported, setImported] = useState(false);
  const [lane, setLane] = useState<Lane>("recipe");
  /** When the render in flight was started, so the wait can be described. */
  const [renderStartedAt, setRenderStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** What the importer changed on the way in — shown rather than applied quietly. */
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [sessionSpend, setSessionSpend] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Reference-to-video: extra references, each with a job.
  const [refs, setRefs] = useState<
    { url: string; media: ReferenceMedia; role: ReferenceRole; name: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  /**
   * Reference failures are shown inside the References step, not in the
   * page-level banner. The banner sits thousands of pixels above the Add
   * reference button, so an error there reads as nothing happening at all.
   */
  const [refError, setRefError] = useState<string | null>(null);
  /**
   * Pasting a URL is the escape hatch when fal's storage service refuses the
   * key — generation and storage are separate services with separate
   * permissions, and a hosted clip needs neither an upload nor live mode.
   */
  const [refUrl, setRefUrl] = useState("");
  const [seconds, setSeconds] = useState<number | null>(null);
  /**
   * Resolution was never sent, so the endpoint's default decided the bill —
   * and on a token-billed model pixel area is most of the bill.
   */
  /**
   * 480p by default. Resolution drives most of the bill on a token-priced
   * model — the same 8-second cut is $1.64 at 480p and $9.10 at 1080p — and
   * the first render of a concept is nearly always a test of whether the idea
   * works, not a deliverable. Starting cheap makes the expensive choice
   * deliberate.
   */
  const [resolution, setResolution] = useState<VideoResolution>("480p");
  /**
   * The preset ships a designed shape, but one concept usually has to deliver
   * several — a vertical for Reels and a square for feed off the same idea.
   * null means "whatever the preset intended".
   */
  const [aspectOverride, setAspectOverride] = useState<string | null>(null);
  const refInput = useRef<HTMLInputElement>(null);
  const promptFileInput = useRef<HTMLInputElement>(null);

  /**
   * Audio settings and recipe edits are baked into the composed prompt, so
   * changing them makes the shown prompt stale — clear it rather than let
   * Generate run a prompt that no longer matches the settings.
   */
  const invalidatePrompt = useCallback(() => {
    setFinalPrompt("");
    setNegativePrompt("");
    setPhase("idle");
  }, []);

  // Vision autofill
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [autofillRationale, setAutofillRationale] = useState<string | null>(null);
  const [autofilledKeys, setAutofilledKeys] = useState<Set<string>>(new Set());

  // The recipe is editable — a preset is a starting point, not a locked asset.
  const [recipe, setRecipe] = useState<EditableRecipe>(() =>
    editableRecipeOf(AD_PRESETS[0]),
  );
  const [editingRecipe, setEditingRecipe] = useState(false);

  // Audio layer
  const [audioMode, setAudioMode] = useState<AudioMode>("layered");
  const [musicStyleId, setMusicStyleId] = useState<string>(AD_PRESETS[0].musicStyleId);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  /** Feed the composed bed back into the render as a timing signal. */
  const [musicAsTimingRef, setMusicAsTimingRef] = useState(false);
  /**
   * Spot effects, keyed by the recipe's sound-design line they came from.
   * The recipe already names the effects this concept needs; generating them
   * is just taking that list seriously.
   */
  const [sfxTracks, setSfxTracks] = useState<Record<string, string>>({});
  const [sfxBusy, setSfxBusy] = useState<string | null>(null);
  const [sfxSeconds, setSfxSeconds] = useState<number>(SFX_LIMITS.defaultSeconds);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const preset = getAdPreset(presetId);
  const cap = audioCapability(modelId);
  const modelName = MODELS[modelId].label.split(" (")[0];
  const supportsRefs = MULTI_REF_MODELS.includes(modelId);
  const secondsCap = maxAdSeconds(modelId);
  const duration = Math.min(seconds ?? preset.durationSeconds, secondsCap);
  const tokenBilled = usesTokenPricing(modelId);
  const allowedAspects = aspectsFor(modelId);
  /** Falling back keeps a Seedance-only shape from being sent to Veo. */
  const aspect =
    allowedAspects.find((a) => a.id === (aspectOverride ?? preset.aspect))?.id ??
    preset.aspect;
  const aspectChanged = aspect !== preset.aspect;
  const frame = frameSize(resolution, aspect);
  /** Reference clips are billed as input duration too, at ~5s apiece. */
  const inputVideoSeconds =
    refs.filter((r) => r.media === "video").length * VIDEO_REF_LIMITS.idealSeconds;
  const videoCost = estimateCost(modelId, {
    seconds: duration,
    resolution,
    aspect,
    hasVideoInputs: inputVideoSeconds > 0,
    inputVideoSeconds,
  });
  const recipeEdited = !isDefaultRecipe(preset, recipe);

  /** Every reference the model will receive, product photo included. */
  const allRefSpecs = useMemo(
    () => [
      ...(productImage ? [{ role: "product", media: "image" }] : []),
      ...refs.map((r) => ({ role: r.role as string, media: r.media as string })),
    ],
    [productImage, refs],
  );
  const recipeChecklist = useMemo(
    () => recipeStatus(preset.referenceRecipe, allRefSpecs),
    [preset.referenceRecipe, allRefSpecs],
  );
  const unmet = useMemo(
    () => (supportsRefs ? unmetCriticalSteps(preset.referenceRecipe, allRefSpecs) : []),
    [preset.referenceRecipe, allRefSpecs, supportsRefs],
  );
  const musicCost = estimateCost(MUSIC_MODEL_ID, {
    seconds: musicLengthFor(duration),
  });
  /** True when a separate music model will actually be billed. */
  const scoringSeparately = audioMode === "layered" && musicStyleId !== NO_MUSIC_ID;
  const cost = videoCost + (scoringSeparately ? musicCost : 0);
  /** Clips and tracks leave the browser, so demo mode can't accept them. */
  const clipsUploadable = health?.live ?? true;
  /** The bed can only steer the render on a model that reads audio in. */
  const timingRefAvailable = cap.refAudio && scoringSeparately;
  const timingRefActive = Boolean(timingRefAvailable && musicAsTimingRef && musicUrl);

  /** Audio references sent to the model, in the order the prompt numbers them. */
  const audioRefUrls = useMemo(
    () => [
      ...refs.filter((r) => r.media === "audio").map((r) => r.url),
      ...(timingRefActive && musicUrl ? [musicUrl] : []),
    ],
    [refs, timingRefActive, musicUrl],
  );
  /** Reference jobs, ordered to match the URLs above per media type. */
  const composeRefs = useMemo<ReferenceSpec[]>(
    () => [
      ...(productImage ? [{ role: "product", media: "image" } as ReferenceSpec] : []),
      ...refs.map((r) => ({ role: r.role, media: r.media }) as ReferenceSpec),
      ...(timingRefActive ? [{ role: "rhythm", media: "audio" } as ReferenceSpec] : []),
    ],
    [productImage, refs, timingRefActive],
  );

  /**
   * A prompt handed over from the Prompts tab. Landing it straight in the
   * composed-prompt box is the point: the library is a study set you can run,
   * not a list you copy out of.
   */
  useEffect(() => {
    try {
      // The Blender page hands over a prompt and asks for its own lane, so the
      // page it lands on is not the eight-step one it just made irrelevant.
      const handedLane = sessionStorage.getItem("adlab-lane");
      if (handedLane === "blender") {
        sessionStorage.removeItem("adlab-lane");
        setLane("blender");
        setProductImage(null);
        setModelId("seedance-2.5-ref");
      }

      const handed = sessionStorage.getItem("adlab-imported-prompt");
      if (handed) {
        sessionStorage.removeItem("adlab-imported-prompt");
        // Same conversion as a file import: a prompt written with playground
        // sigils resolves to nothing through the API, and does it silently.
        const result = importPrompt(handed);
        setFinalPrompt(result.prompt);
        setNegativePrompt(AD_NEGATIVE_PROMPT);
        setPhase("ready");
        setImported(true);
        // A prompt addressing [Image1] or [Video1] only means anything on the
        // endpoint that resolves them. Landing it on a first-frame model would
        // read the tokens as literal text — the exact silent failure the
        // builder warns about — so route it to the model it was written for.
        if (/\[(?:Image|Video|Audio)\d+\]/.test(result.prompt)) {
          setModelId("seedance-2.5-ref");
        }
        const notes = [...result.notes];
        if (result.aspect && ASPECTS.some((a) => a.id === result.aspect)) {
          setAspectOverride(result.aspect);
          notes.push(`The prompt states ${result.aspect}, so the shape is set to match the blockout.`);
        }
        setImportNotes(notes);
      }
      // A timeline written for 14 seconds is wrong at 8, so the length comes
      // across with it rather than being left at the preset's.
      const handedDuration = Number(sessionStorage.getItem("adlab-imported-duration"));
      if (Number.isFinite(handedDuration) && handedDuration >= 4) {
        sessionStorage.removeItem("adlab-imported-duration");
        setSeconds(handedDuration);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      setSessionSpend(Number(localStorage.getItem(SPEND_KEY) ?? 0));
    } catch {}
    // A render left running when the tab closed. Offer it back rather than
    // letting a paid job disappear because the browser did.
    try {
      const raw = localStorage.getItem(JOB_KEY);
      if (raw) {
        const job = JSON.parse(raw) as PendingJob;
        // fal keeps results for a day; older than that and the handle is dead.
        if (Date.now() - job.startedAt < 24 * 60 * 60 * 1000) setPendingJob(job);
        else localStorage.removeItem(JOB_KEY);
      }
    } catch {}
  }, []);

  const rememberJob = useCallback((job: PendingJob | null) => {
    setPendingJob(job);
    try {
      if (job) localStorage.setItem(JOB_KEY, JSON.stringify(job));
      else localStorage.removeItem(JOB_KEY);
    } catch {}
  }, []);

  /**
   * One status check against an already-paid render. Free — it reads a result
   * fal has already produced — so the button that calls it says so.
   */
  const checkPendingJob = useCallback(async () => {
    if (!pendingJob) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/video/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: pendingJob.provider,
          operationName: pendingJob.operationName,
          falRequestId: pendingJob.falRequestId,
          modelId: pendingJob.modelId,
        }),
      });
      const status = (await res.json()) as {
        status?: string;
        videoUrl?: string;
        error?: string;
      };
      if (status.status === "done" && status.videoUrl) {
        setVideoUrl(status.videoUrl);
        setPhase("done");
        rememberJob(null);
        return;
      }
      if (status.status === "failed") {
        setError(status.error ?? "The provider reported this render as failed.");
        rememberJob(null);
        return;
      }
      setError("Still rendering on the provider side. Check again in a minute.");
    } catch {
      setError("Could not reach the provider. Check again in a moment.");
    } finally {
      setChecking(false);
    }
  }, [pendingJob, rememberJob]);

  /** Ask fal what this key has actually rendered lately. */
  const loadRecent = useCallback(async () => {
    setRecovering(true);
    setRecoverError(null);
    try {
      const res = await fetch("/api/ad/recent");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not read render history");
      setRecent(json.requests ?? []);
    } catch (e) {
      setRecent(null);
      setRecoverError(e instanceof Error ? e.message : "Could not read render history");
    } finally {
      setRecovering(false);
    }
  }, []);

  /** Collect a specific past render by its provider request id. */
  const collectById = useCallback(
    async (requestId: string, forModelId = modelId) => {
      const id = requestId.trim();
      if (!id) return;
      setRecovering(true);
      setRecoverError(null);
      try {
        const res = await fetch("/api/generate/video/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: "fal", falRequestId: id, modelId: forModelId }),
        });
        const status = (await res.json()) as {
          status?: string;
          videoUrl?: string;
          error?: string;
        };
        if (status.status === "done" && status.videoUrl) {
          setVideoUrl(status.videoUrl);
          setPhase("done");
          setRecoverOpen(false);
          rememberJob(null);
          return;
        }
        setRecoverError(
          status.status === "pending"
            ? "That render is still going. Try again in a minute."
            : (status.error ??
              "No render found under that id on the model selected above. If it was made with a different model, switch to it and try again."),
        );
      } catch {
        setRecoverError("Could not reach the provider.");
      } finally {
        setRecovering(false);
      }
    },
    [modelId, rememberJob],
  );

  const addSpend = useCallback((amount: number) => {
    setSessionSpend((prev) => {
      const next = Number((prev + amount).toFixed(4));
      try {
        localStorage.setItem(SPEND_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  /**
   * Photo is the source of truth: every field the vision model can ground in
   * the image is overwritten; fields it can't determine (e.g. no printed
   * price) keep whatever the user typed.
   */
  const runAutofill = useCallback(
    async (imageDataUrl: string, forPresetId: string) => {
      setAutofillBusy(true);
      setAutofillRationale(null);
      try {
        const res = await fetch("/api/ad/autofill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ presetId: forPresetId, imageDataUrl }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Photo analysis failed");
        const values = json.values as Record<string, string>;
        const filled = new Set<string>();
        setParams((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(values)) {
            if (value) {
              next[key] = value;
              filled.add(key);
            }
          }
          return next;
        });
        setAutofilledKeys(filled);
        setAutofillRationale(json.rationale ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Photo analysis failed");
      } finally {
        setAutofillBusy(false);
      }
    },
    [],
  );

  const selectPreset = useCallback(
    (id: string) => {
      const next = getAdPreset(id);
      setPresetId(id);
      setRecipe(editableRecipeOf(next));
      // A blank recipe in read mode is a set of empty headings, which reads as
      // broken rather than as an invitation. The custom concept opens straight
      // into the editor; a worked preset is worth reading first.
      setEditingRecipe(id === CUSTOM_PRESET_ID);
      setMusicStyleId(next.musicStyleId);
      setModelId(next.preferredModelId ?? "seedance-2.5-ref");
      setMusicUrl(null);
      setMusicAsTimingRef(false);
      setSfxTracks({});
      setSeconds(null);
      setAspectOverride(null);
      setRefs([]);
      setRefError(null);
      setRefUrl("");
      setParams({});
      setAutofilledKeys(new Set());
      setAutofillRationale(null);
      setFinalPrompt("");
      setNegativePrompt("");
      setPhase("idle");
      setVideoUrl(null);
      setPosterDataUrl(null);
      setError(null);
      // A different preset asks different questions of the same photo.
      if (productImage) void runAutofill(productImage, id);
    },
    [productImage, runAutofill],
  );

  /** Silent models have no native audio to choose; don't offer the option. */
  useEffect(() => {
    if (!cap.native && audioMode === "native") {
      setAudioMode("layered");
      invalidatePrompt();
    }
    if (!cap.refAudio && musicAsTimingRef) setMusicAsTimingRef(false);
  }, [cap.native, cap.refAudio, audioMode, musicAsTimingRef, invalidatePrompt]);

  const editRecipe = useCallback(
    (patch: Partial<EditableRecipe>) => {
      setRecipe((prev) => ({ ...prev, ...patch }));
      invalidatePrompt();
    },
    [invalidatePrompt],
  );

  const loadExample = useCallback(() => {
    setParams(Object.fromEntries(preset.fields.map((f) => [f.key, f.example])));
    setAutofilledKeys(new Set());
    setAutofillRationale(null);
  }, [preset]);

  /**
   * Takes a prompt written elsewhere — the Blender page, a text file, a note —
   * and lands it in the composed-prompt box ready to run.
   *
   * The conversion it does on the way in is the point. A prompt written for a
   * playground addresses references as `@Image 1`; this lab calls the API,
   * where the same reference is `[Image1]`. Pasted through unconverted the
   * token is read as prose, the reference is silently ignored, and you pay for
   * a plausible video built on nothing. Everything it changed is listed back
   * rather than done quietly.
   */
  const takePrompt = useCallback((raw: string) => {
    const result = importPrompt(raw);
    if (!result.prompt.trim()) {
      setImportError("That file had no prompt in it.");
      return;
    }
    setImportError(null);
    setFinalPrompt(result.prompt);
    setNegativePrompt(AD_NEGATIVE_PROMPT);
    setImported(true);
    setPhase("ready");
    if (result.seconds) setSeconds(result.seconds);
    // A prompt written for a square clay pass rendered at 9:16 does not
    // letterbox — the model reframes, and the blocking the blockout settled is
    // gone. Only applied when the endpoint actually offers that shape, and
    // only narrated when it was applied.
    const notes = [...result.notes];
    if (result.aspect && ASPECTS.some((a) => a.id === result.aspect)) {
      setAspectOverride(result.aspect);
      notes.push(`The prompt states ${result.aspect}, so the shape is set to match the blockout.`);
    } else if (result.aspect) {
      notes.push(`The prompt states ${result.aspect}, which this model does not render. Pick the closest shape below.`);
    }
    setImportNotes(notes);
    // A prompt addressing [Video1] only means anything on an endpoint that
    // resolves positional references. On a first-frame model the token is
    // literal text — the same silent failure, one step further along.
    if ((result.slots.video > 0 || result.slots.image > 1) && !MULTI_REF_MODELS.includes(modelId)) {
      setModelId("seedance-2.5-ref");
    }
  }, [modelId]);

  const readPromptFile = useCallback(
    async (file: File) => {
      if (!isPromptFile(file)) {
        setImportError("Pick a .txt or .md file — anything else arrives as gibberish.");
        return;
      }
      if (file.size > MAX_PROMPT_FILE_BYTES) {
        setImportError(
          `That file is ${Math.round(file.size / 1024)}KB. A prompt is a few KB — this looks like the wrong file.`,
        );
        return;
      }
      try {
        takePrompt(await file.text());
      } catch {
        setImportError("Could not read that file.");
      }
    },
    [takePrompt],
  );

  /**
   * Switching into the Blender lane clears the product photo, and says so.
   *
   * The photo is not merely unused here — it is actively wrong. The API
   * prepends it to the reference list, so it becomes `[Image1]` and every
   * index in the prompt shifts by one: the package reference resolves to the
   * hand, the hand to the set. That failure is invisible until the render
   * comes back, so it has to be impossible rather than warned about.
   */
  const switchLane = useCallback((next: Lane) => {
    setLane(next);
    setImportError(null);
    if (next === "blender") {
      setProductImage((prev) => {
        if (prev) {
          setImportNotes((n) => [
            ...n,
            "Removed the product photo. In this lane the API would send it as [Image1] and shift every reference index in your prompt by one.",
          ]);
        }
        return null;
      });
      setAutofilledKeys(new Set());
      setAutofillRationale(null);
      setModelId((m) => (MULTI_REF_MODELS.includes(m) ? m : "seedance-2.5-ref"));
    }
  }, []);

  const compose = useCallback(async () => {
    setError(null);
    setPhase("composing");
    try {
      const res = await fetch("/api/ad/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presetId,
          params,
          audioMode,
          musicStyleId,
          modelId,
          aspect,
          durationSeconds: duration,
          // Only sent when edited — an untouched preset keeps the hand-tuned
          // prompt it was written as.
          recipe: recipeEdited ? recipe : undefined,
          references: supportsRefs ? composeRefs : [],
          imageDataUrl: productImage ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Compose failed");
      setFinalPrompt(json.finalPrompt);
      setNegativePrompt(json.negativePrompt);
      setImported(false);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compose failed");
      setPhase("idle");
    }
  }, [
    aspect,
    audioMode,
    composeRefs,
    duration,
    modelId,
    musicStyleId,
    params,
    presetId,
    productImage,
    recipe,
    recipeEdited,
    supportsRefs,
  ]);

  const addReference = useCallback(
    async (file: File) => {
      setError(null);
      setRefError(null);
      // MIME type alone mis-routes .mov files, which then hit the image
      // decoder and fail with a message about an unreadable image.
      const media = referenceMediaOf(file.name, file.type);
      const isAudio = media === "audio";
      try {
        if (media !== "image") {
          const limits = isAudio ? AUDIO_REF_LIMITS : VIDEO_REF_LIMITS;
          // Clips and tracks leave the browser, so they need live mode. Say so
          // before the upload rather than after a round trip.
          if (health && !health.live) {
            setRefError(
              `${isAudio ? "Tracks" : "Clips"} upload to the generation provider, so they need live mode — and this session is in demo mode. Unlock it with the "Demo mode · Unlock" button at the top of this page, or use image references, which stay in the browser.`,
            );
            return;
          }
          // Check size locally too — no point spending upload time on a file
          // the server is going to reject.
          // Which ceiling applies depends on which path the file will take.
          const cap = health?.blob ? limits.maxBytesDirect : limits.maxBytes;
          const capMB = health?.blob ? limits.maxMBDirect : limits.maxMB;
          if (file.size > cap) {
            setRefError(
              isAudio
                ? `That track is ${(file.size / 1024 / 1024).toFixed(1)}MB. Trim it under ${capMB}MB — the reference only needs to be as long as the cut.`
                : `That clip is ${(file.size / 1024 / 1024).toFixed(1)}MB. Trim it under ${capMB}MB — around ${VIDEO_REF_LIMITS.idealSeconds} seconds is all the model reads.`,
            );
            return;
          }
          // Clips and tracks upload to the provider once and travel as a URL —
          // inlining them as base64 would blow past the request size limit.
          setUploading(true);
          let url: string;
          if (health?.blob) {
            // Straight from the browser to Blob. The alternative — posting the
            // file to our own route — puts it through a Function, whose
            // request body is capped at 4.5MB, which is under the size of most
            // of the clips this is for.
            const { upload } = await import("@vercel/blob/client");
            const result = await upload(`references/${file.name}`, file, {
              access: "public",
              handleUploadUrl: "/api/blob/upload",
            });
            url = result.url;
          } else {
            const form = new FormData();
            form.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: form });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? "Upload failed");
            url = json.url;
          }
          setRefs((prev) => [
            ...prev,
            {
              url,
              media,
              role: isAudio ? "rhythm" : "motion",
              name: file.name,
            },
          ]);
        } else {
          const dataUrl = await toProcessedDataUrl(file);
          setRefs((prev) => [
            ...prev,
            { url: dataUrl, media: "image", role: "style", name: file.name },
          ]);
        }
        invalidatePrompt();
      } catch (e) {
        setRefError(e instanceof Error ? e.message : "Could not add that reference");
      } finally {
        setUploading(false);
      }
    },
    [health, invalidatePrompt],
  );

  /** Adds an already-hosted reference. No upload, so no storage permission. */
  const addReferenceUrl = useCallback(() => {
    setError(null);
    setRefError(null);
    const url = refUrl.trim();
    if (!url) return;
    const media = referenceMediaOfUrl(url);
    if (!media) {
      setRefError(
        `That URL doesn't end in a file extension this model reads. It needs to point straight at the file — ${VIDEO_REF_LIMITS.formats} for clips, ${AUDIO_REF_LIMITS.formats} for tracks, JPG/PNG/WebP for stills — not at a page that plays it. A YouTube or Drive link won't work; a direct link ending in .mp4 will.`,
      );
      return;
    }
    setRefs((prev) => [
      ...prev,
      {
        url,
        media,
        role: media === "audio" ? "rhythm" : media === "video" ? "motion" : "style",
        name: url.split("/").pop() ?? url,
      },
    ]);
    setRefUrl("");
    invalidatePrompt();
  }, [invalidatePrompt, refUrl]);

  const sfxCost = estimateCost(SFX_MODEL_ID, { seconds: clampSfxSeconds(sfxSeconds) });

  /** One effect per call — two events in one prompt gives a muddle of both. */
  const generateSfx = useCallback(
    async (text: string) => {
      setError(null);
      setSfxBusy(text);
      try {
        const res = await fetch("/api/ad/sfx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, durationSeconds: sfxSeconds }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Sound effect failed");
        if (!json.mock) addSpend(json.cost ?? 0);
        setSfxTracks((prev) => ({ ...prev, [text]: json.audioUrl }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sound effect failed");
      } finally {
        setSfxBusy(null);
      }
    },
    [addSpend, sfxSeconds],
  );

  const generateMusic = useCallback(async () => {
    setError(null);
    setMusicBusy(true);
    try {
      const res = await fetch("/api/ad/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: musicStyleId, durationSeconds: duration }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Music generation failed");
      if (!json.mock) addSpend(json.cost ?? 0);
      setMusicUrl(json.audioUrl);
      setMusicOn(true);
      // A bed used as a timing signal changes the prompt, so it goes stale.
      if (musicAsTimingRef) invalidatePrompt();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Music generation failed");
    } finally {
      setMusicBusy(false);
    }
  }, [addSpend, duration, invalidatePrompt, musicAsTimingRef, musicStyleId]);

  /** Keep the separately generated music bed locked to the video's transport. */
  const syncAudio = useCallback(
    (action: "play" | "pause" | "seek") => {
      const v = videoRef.current;
      const a = audioRef.current;
      if (!v || !a) return;
      if (action === "pause") {
        a.pause();
        return;
      }
      a.currentTime = Math.min(v.currentTime, a.duration || v.currentTime);
      if (action === "play" && musicOn) void a.play().catch(() => {});
    },
    [musicOn],
  );

  const generate = useCallback(async () => {
    setError(null);
    if (health?.live) {
      const ok = window.confirm(
        `This will run one live ${duration}s video generation at an estimated cost of $${cost.toFixed(2)}. Proceed?`,
      );
      if (!ok) return;
    }
    setPhase("starting");
    setRenderStartedAt(Date.now());
    setElapsedMs(0);
    setVideoUrl(null);
    setPosterDataUrl(null);
    // Score in parallel with the render — music returns in seconds, video in
    // minutes. Not when the bed is a timing reference: then it has to exist
    // before the render starts, and the button blocks until it does.
    if (scoringSeparately && !musicUrl && !timingRefActive) void generateMusic();
    try {
      const res = await fetch("/api/ad/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          negativePrompt,
          modelId,
          aspect,
          durationSeconds: duration,
          resolution,
          imageDataUrl: productImage ?? undefined,
          referenceImageDataUrls: supportsRefs
            ? refs.filter((r) => r.media === "image").map((r) => r.url)
            : undefined,
          referenceVideoUrls: supportsRefs
            ? refs.filter((r) => r.media === "video").map((r) => r.url)
            : undefined,
          referenceAudioUrls: supportsRefs ? audioRefUrls : undefined,
          generateAudio: audioMode !== "silent",
          presetName: preset.name,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start");
      if (json.mock) {
        setPosterDataUrl(json.posterDataUrl);
        setPhase("mock");
        return;
      }
      addSpend(json.cost ?? 0);
      // Save the handle before the first poll, not after the last one: from
      // here on the render is paid for, and every path out of this function
      // has to leave it recoverable.
      rememberJob({
        provider: json.provider,
        operationName: json.operationName,
        falRequestId: json.falRequestId,
        modelId,
        startedAt: Date.now(),
        label: `${preset.name} · ${duration}s`,
        aspect,
      });
      setPhase("polling");
      const deadline = Date.now() + POLL_DEADLINE_MS;
      while (Date.now() < deadline) {
        await sleep(POLL_INTERVAL_MS);
        let status: { status?: string; videoUrl?: string; error?: string } | null = null;
        try {
          const sres = await fetch("/api/generate/video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: json.provider,
              operationName: json.operationName,
              falRequestId: json.falRequestId,
              modelId,
            }),
          });
          status = await sres.json();
        } catch {
          // Transient network error — the render is still running, keep polling.
          continue;
        }
        if (status?.status === "done") {
          setVideoUrl(status.videoUrl!);
          setPhase("done");
          rememberJob(null);
          return;
        }
        if (status?.status === "failed") {
          rememberJob(null);
          throw new Error(status.error ?? "Generation failed");
        }
      }
      // Deliberately leaves the handle in place — the render is still running
      // and already paid for, so the failed screen offers to collect it.
      throw new Error(
        "Still rendering after 10 minutes. Nothing is lost — the job is finishing on the provider side and you can collect it below.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("failed");
    }
  }, [
    addSpend,
    aspect,
    audioMode,
    audioRefUrls,
    cost,
    duration,
    finalPrompt,
    generateMusic,
    health,
    modelId,
    musicUrl,
    negativePrompt,
    preset,
    rememberJob,
    resolution,
    productImage,
    refs,
    scoringSeparately,
    supportsRefs,
    timingRefActive,
  ]);

  /**
   * Step numbers, derived once. Reference-to-video adds a step in the middle,
   * so everything after it shifts — and the copy cross-references these, which
   * is how a reorder quietly leaves five sentences pointing at the wrong step.
   */
  const blenderLane = lane === "blender";
  const STEP = blenderLane
    ? // The prompt comes first here: it decides how many references are
      // needed and how long the render has to be, so everything below reads
      // off it. Concept, product and recipe do not exist in this lane, and
      // are given 0 so any copy that still points at them is obvious.
      { concept: 0, product: 0, recipe: 0, prompt: 1, refs: 2, format: 3, sound: 4, generate: 5 }
    : {
        concept: 1,
        product: 2,
        recipe: 3,
        refs: 4,
        format: supportsRefs ? 5 : 4,
        sound: supportsRefs ? 6 : 5,
        prompt: supportsRefs ? 7 : 6,
        generate: supportsRefs ? 8 : 7,
      };

  /**
   * One import control, used by both lanes. A prompt is a text file; there is
   * no reason the only way in should be retyping it.
   */
  const importControl = (
    <>
      <button
        className="text-xs font-semibold text-accent hover:underline"
        onClick={() => promptFileInput.current?.click()}
      >
        Import from .txt or .md
      </button>
      <input
        ref={promptFileInput}
        type="file"
        accept={PROMPT_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void readPromptFile(f);
          e.target.value = "";
        }}
      />
    </>
  );

  /**
   * What the prompt asks for against what has been uploaded.
   *
   * A prompt saying `[Image3]` with two images attached is not a warning the
   * surface gives you — it resolves what it can and invents the rest. Counting
   * is cheap and the mismatch is the single most expensive mistake in this
   * lane, so it is checked before the spend button rather than after.
   */
  const promptSlots = useMemo(() => refSlots(finalPrompt), [finalPrompt]);
  const attached = useMemo(
    () => ({
      image: (productImage ? 1 : 0) + refs.filter((r) => r.media === "image").length,
      video: refs.filter((r) => r.media === "video").length,
      audio: audioRefUrls.length,
    }),
    [productImage, refs, audioRefUrls],
  );
  const slotGaps = useMemo(
    () =>
      (["video", "image", "audio"] as const)
        .filter((k) => promptSlots[k] > attached[k])
        .map((k) => ({
          kind: k,
          wants: promptSlots[k],
          has: attached[k],
        })),
    [promptSlots, attached],
  );

  /*
   * Not every endpoint renders every size. The reference endpoint tops out at
   * 720p, so 1080p is removed rather than offered and rejected — and a
   * selection left over from another model is pulled back to the best one this
   * endpoint does render, so the estimate on screen is the one that will be
   * charged.
   */
  const allowedResolutions = useMemo(() => {
    const ok = resolutionsFor(modelId);
    return VIDEO_RESOLUTIONS.filter((r) => ok.includes(r.id));
  }, [modelId]);
  useEffect(() => {
    if (!allowedResolutions.some((r) => r.id === resolution)) {
      setResolution(allowedResolutions[allowedResolutions.length - 1].id);
    }
  }, [allowedResolutions, resolution]);

  /*
   * The provider validates references only at submit time, and reports a
   * failure in one sentence about content policy that covers everything from
   * a genuine filter hit to a URL it could not open. Checking the mechanical
   * constraints here first costs nothing and takes most of those causes off
   * the table before any credits are committed.
   */
  const [refCheck, setRefCheck] = useState<RefFinding[] | null>(null);
  const [checkingRefs, setCheckingRefs] = useState(false);
  const checkRefs = useCallback(async () => {
    setCheckingRefs(true);
    setRefCheck(null);
    try {
      const res = await fetch("/api/ad/check-refs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: [
            ...(productImage ? [productImage] : []),
            ...refs.filter((r) => r.media === "image").map((r) => r.url),
          ],
          videoUrls: refs.filter((r) => r.media === "video").map((r) => r.url),
        }),
      });
      const json = await res.json();
      setRefCheck(json.findings ?? []);
    } catch {
      setError("Could not run the reference check.");
    } finally {
      setCheckingRefs(false);
    }
  }, [productImage, refs]);

  /**
   * Loads a brief that is known to render, references and all.
   *
   * The settings come with it because they are part of what worked: this
   * timeline is written for 12 seconds and loses its last beat at eight, the
   * blockout was rendered 4:3, and the endpoint tops out at 720p. Landing the
   * prompt alone would leave someone one wrong slider away from paying for a
   * take that does not match the geometry it was built on.
   */
  const loadBlenderExample = useCallback(() => {
    setLane("blender");
    setError(null);
    setImportError(null);
    setProductImage(null);
    setModelId(BLENDER_EXAMPLE.modelId);
    setFinalPrompt(BLENDER_EXAMPLE.prompt.trim());
    setNegativePrompt(AD_NEGATIVE_PROMPT);
    setSeconds(BLENDER_EXAMPLE.seconds);
    setAspectOverride(BLENDER_EXAMPLE.aspect);
    setResolution(BLENDER_EXAMPLE.resolution);
    setAudioMode("native");
    // Replaces rather than appends: loading the example twice should not leave
    // the clay pass sitting at [Video1] and [Video2].
    setRefs(
      BLENDER_EXAMPLE.refs.map((r) => ({
        url: r.url,
        media: r.media as ReferenceMedia,
        role: r.role as ReferenceRole,
        name: r.name,
      })),
    );
    setRefCheck(null);
    setImported(true);
    setImportNotes([
      `Loaded “${BLENDER_EXAMPLE.label}” — the prompt, both references, and the length, shape and resolution the successful render used.`,
      ...BLENDER_EXAMPLE.refs.map((r) => `${r.name} — ${r.note}`),
    ]);
    setPhase("ready");
  }, []);

  /*
   * Ticks once a second while a render is in flight, and only then. A timer
   * that keeps running after the video arrives is a needless re-render every
   * second for as long as the tab stays open.
   */
  const rendering = phase === "starting" || phase === "polling";
  useEffect(() => {
    if (!rendering || renderStartedAt === null) return;
    const tick = () => setElapsedMs(Date.now() - renderStartedAt);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [rendering, renderStartedAt]);

  /**
   * What to say about a wait, and how full to draw the bar.
   *
   * The bar is capped below full while the render is still running: a
   * progress indicator sitting at 100% next to a spinner reads as broken, and
   * the finish time is an estimate, not a promise.
   */
  const renderStage =
    elapsedMs >= OVERDUE_MS
      ? "overdue"
      : elapsedMs >= ALMOST_READY_MS
        ? "almost"
        : "running";
  const renderProgress = Math.min(0.94, elapsedMs / TYPICAL_RENDER_MS);

  /** There is a passcode gate on this deployment, so a code can be entered. */
  const gateable = health?.gate === "locked" || health?.gate === "exhausted";

  /** Something was flagged above the spend button, whichever lane raised it. */
  const flagged = blenderLane ? slotGaps.length > 0 : unmet.length > 0;

  /** The bed must exist before a render that keys off it. */
  const blockedOnMusic = timingRefAvailable && musicAsTimingRef && !musicUrl;

  const audioChoices = [
    ...(cap.native
      ? [
          {
            id: "native" as AudioMode,
            title: `Native — ${modelName} carries all of it`,
            body: cap.refAudio
              ? "Sound and picture are generated in one pass, so effects land on frame. One call, one file — but the model approximates music rather than composing it."
              : "One call, one file: effects, ambience and an attempt at music, all rendered with the picture. The effects are good; the music is a texture, not a track.",
          },
        ]
      : []),
    {
      id: "layered" as AudioMode,
      title: cap.native
        ? `Layered — ${modelName} does effects, a music model scores it`
        : `Layered — a composed music bed (${modelName} renders no sound)`,
      body: cap.native
        ? "How a studio actually does it. The video model renders the effects it can see itself making; ElevenLabs Music writes a real track over the top."
        : "This model returns a silent MP4, so the whole soundtrack is built here: ElevenLabs Music writes the bed and you add effects in the edit.",
    },
    {
      id: "silent" as AudioMode,
      title: "Silent — deliver picture only",
      body: cap.switchable
        ? `Native audio is switched off at the API, not just asked off in the prompt. The right choice when the ad will be cut to a licensed track.`
        : "The prompt asks for a silent take. The right choice when the ad will be cut to a licensed track.",
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
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
          {/* Live-mode state sits with the other connection chips, not in the nav. */}
          <LiveGate />
          {health && !health.live && !health.gemini && !health.fal && (
            <span className="chip border-warning/40 text-warning">
              Demo mode — zero-cost mocks; add API keys to go live
            </span>
          )}
        </div>
        <span className="chip">Session spend: ${sessionSpend.toFixed(2)}</span>
      </div>

      {/* Recovery: a render that was paid for but never made it onto the page. */}
      <div className="mt-3">
        <button
          className="text-xs font-semibold text-muted underline decoration-dotted underline-offset-4 hover:text-foreground"
          onClick={() => {
            setRecoverOpen((v) => !v);
            if (!recent && !recovering) void loadRecent();
          }}
        >
          {recoverOpen ? "Hide past renders" : "Looking for a render you already paid for?"}
        </button>
      </div>

      {recoverOpen && (
        <div className="mt-3 rounded-[6px] border border-border-soft bg-surface-2 p-4">
          <p className="label">Past renders on this fal key</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            A render that timed out, or one started before this page began
            remembering job handles, still exists on the provider. Collecting
            it costs nothing — the work is already done and billed.
          </p>

          {recovering && !recent && (
            <p className="mt-3 text-xs text-muted">Reading your request history…</p>
          )}

          {recent && recent.length > 0 && (
            <ul className="mt-3 space-y-2">
              {recent.map((r) => (
                <li
                  key={r.requestId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-border-soft bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {r.endpoint}
                    </p>
                    <p className="truncate font-mono text-[10px] text-muted">
                      {r.requestId}
                      {r.endedAt ? ` · ${new Date(r.endedAt).toLocaleString()}` : ""}
                    </p>
                  </div>
                  {r.videoUrl ? (
                    <button
                      className="btn-secondary !py-1 !text-xs"
                      onClick={() => {
                        setVideoUrl(r.videoUrl!);
                        setPhase("done");
                        setRecoverOpen(false);
                      }}
                    >
                      View
                    </button>
                  ) : (
                    <button
                      className="btn-secondary !py-1 !text-xs"
                      disabled={recovering}
                      onClick={() => void collectById(r.requestId)}
                    >
                      Collect
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {recent && recent.length === 0 && (
            <p className="mt-3 text-xs text-muted">
              No recent video requests on this key.
            </p>
          )}

          {/* Always available: the history API needs a permission the render
              key may not carry, but a request id from the fal dashboard is
              enough on its own. */}
          <div className="mt-4 border-t border-border-soft pt-3">
            <label className="label-sm" htmlFor="paste-request-id">
              Or paste a request ID
            </label>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              fal dashboard → Requests. Collected against{" "}
              <span className="font-semibold text-foreground">{modelName}</span>,
              the model selected above — switch models first if the render was
              made with a different one.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                id="paste-request-id"
                className="input flex-1 min-w-[16rem] font-mono text-xs"
                placeholder="e.g. 7f3c1a2e-8b90-4d6f-..."
                value={pastedId}
                onChange={(e) => setPastedId(e.target.value)}
              />
              <button
                className="btn-secondary"
                disabled={!pastedId.trim() || recovering}
                onClick={() => void collectById(pastedId)}
              >
                {recovering ? "Checking…" : "Collect"}
              </button>
            </div>
          </div>

          {recoverError && (
            <p className="mt-3 text-xs leading-relaxed text-warning">{recoverError}</p>
          )}
        </div>
      )}

      {/* A paid render from a previous visit that was never collected. */}
      {pendingJob && phase === "idle" && (
        <div className="mt-4 rounded-[6px] border border-accent/40 bg-accent/5 p-4">
          <p className="label">Unfinished render</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground">
            <span className="font-semibold">{pendingJob.label}</span> was started{" "}
            {relativeTime(pendingJob.startedAt)} and never collected. It was
            already paid for, so fetching it costs nothing.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              className="btn-primary"
              disabled={checking}
              onClick={() => void checkPendingJob()}
            >
              {checking ? "Checking…" : "Collect it"}
            </button>
            <button
              className="text-xs font-semibold text-muted hover:text-foreground"
              onClick={() => rememberJob(null)}
            >
              Discard
            </button>
            {pendingJob.falRequestId && (
              <code className="font-mono text-[10px] text-muted">
                {pendingJob.falRequestId}
              </code>
            )}
          </div>
          {error && <p className="mt-2 text-xs text-warning">{error}</p>}
        </div>
      )}

      <h1 className="mt-6 text-[1.75rem] tracking-[-0.03em]">Ad Lab</h1>
      <p className="mt-2 max-w-3xl text-muted">
        {blenderLane ? (
          <>
            Running a prompt written against a{" "}
            <span className="font-semibold text-foreground">clay control pass</span>. The
            blockout has already decided camera, timing and blocking, so the
            lab does not ask about them again — it attaches the references,
            picks the shape and length, and spends.
          </>
        ) : (
          <>
            Mini product ads as{" "}
            <span className="font-semibold text-foreground">preset recipes</span>: each
            concept is a structured, deconstructed prompt — aesthetics,
            beat-by-beat action, text overlay spec, sound design — with the
            product swappable per SKU. Design the concept once; run any product
            through it, and edit any part of it when the brief moves.
          </>
        )}
      </p>

      {error && (
        <div className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      )}

      {/*
        Which lane you are in changes which steps exist, so it is the first
        decision on the page rather than a toggle buried in the format step.
      */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {(
          [
            {
              id: "recipe" as Lane,
              title: "Start from a concept",
              body: "Pick a recipe, upload the pack, and the lab writes the prompt. Eight steps, nothing needed beforehand.",
            },
            {
              id: "blender" as Lane,
              title: "I already have a prompt",
              body: "For a shot blocked out in Blender first. Skips concept, product and recipe — the clay pass already settled all three. Five steps.",
            },
          ]
        ).map((l) => (
          <button
            key={l.id}
            onClick={() => switchLane(l.id)}
            aria-pressed={lane === l.id}
            className={`rounded-[6px] border p-4 text-left transition ${
              lane === l.id
                ? "border-accent bg-accent/[0.05] ring-1 ring-accent"
                : "border-border-soft hover:border-accent/50"
            }`}
          >
            <h2 className="text-sm font-semibold">{l.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{l.body}</p>
          </button>
        ))}
      </div>

      {blenderLane && (
        <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
          Concept, product and recipe are not hidden to shorten the page — they
          are hidden because running them here would produce a prompt you are
          not going to use, and a product photo that shifts every reference
          index in the one you are.{" "}
          <Link href="/ai-studio/blender" className="font-semibold text-accent hover:underline">
            Write the prompt on the Blender page →
          </Link>
        </p>
      )}

      {/*
        A brief that renders, one click away. Everything else on this page is a
        claim about how the workflow goes; this is the workflow, loaded.
      */}
      {blenderLane && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-accent/40 bg-accent/[0.05] p-4">
          <p className="min-w-0 flex-1 text-sm leading-relaxed">
            <span className="font-semibold">New here?</span>{" "}
            <span className="text-muted">
              Load a brief that is known to render — the prompt, a clay control
              pass, a product still, and the exact settings the finished take
              used.
            </span>
          </p>
          <button className="btn-primary shrink-0" onClick={loadBlenderExample}>
            Load the worked example →
          </button>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {/* ---------- the Blender lane opens on the prompt itself ---------- */}
        {blenderLane && (
          <Step
            n={STEP.prompt}
            title="Your prompt"
            aside={
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="text-xs font-semibold text-accent hover:underline"
                  onClick={loadBlenderExample}
                >
                  Load the worked example
                </button>
                {importControl}
              </div>
            }
          >
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              Paste the prompt the Blender page composed, or import the{" "}
              <code className="font-mono text-xs">.txt</code> you saved next to
              the .blend. Reference tokens are converted to the bracketed form
              the API resolves on the way in — <code className="font-mono text-xs">@Image 1</code>{" "}
              becomes <code className="font-mono text-xs">[Image1]</code>.
            </p>

            {importError && (
              <p className="mt-3 rounded-[6px] border border-warning/50 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                {importError}
              </p>
            )}

            <label className="mt-4 block">
              <span className="mb-1 block label">Video prompt</span>
              <textarea
                className="input min-h-64 font-mono text-xs leading-relaxed"
                placeholder={"MODE: Clay Renderer / Omni Reference\nMATERIALS: [Video1] clay blockout · [Image1] product package…"}
                value={finalPrompt}
                onChange={(e) => {
                  setFinalPrompt(e.target.value);
                  setPhase(e.target.value ? "ready" : "idle");
                }}
                onBlur={(e) => {
                  // Typed or pasted rather than imported: convert on the way
                  // out of the box, so the same silent failure is impossible
                  // whichever route the prompt took in.
                  const fixed = importPrompt(e.target.value);
                  if (fixed.prompt !== e.target.value.trim() && e.target.value.trim()) {
                    setFinalPrompt(fixed.prompt);
                    setImportNotes(fixed.notes);
                    if (fixed.seconds) setSeconds(fixed.seconds);
                  }
                }}
              />
            </label>
            <label className="mt-3 block">
              <span className="mb-1 block label">Negative prompt</span>
              <input
                className="input font-mono text-xs"
                placeholder={AD_NEGATIVE_PROMPT}
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
              />
            </label>

            {importNotes.length > 0 && (
              <div className="mt-4 rounded-[6px] border border-accent/30 bg-accent/[0.05] p-3">
                <p className="label !text-accent">What came in with it</p>
                <ul className="mt-2 space-y-1.5">
                  {importNotes.map((n, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {finalPrompt && (promptSlots.video > 0 || promptSlots.image > 0) && (
              <p className="mt-3 text-xs leading-relaxed text-muted">
                This prompt addresses{" "}
                <span className="font-semibold text-foreground">
                  {[
                    promptSlots.video && `${promptSlots.video} clip${promptSlots.video === 1 ? "" : "s"}`,
                    promptSlots.image && `${promptSlots.image} still${promptSlots.image === 1 ? "" : "s"}`,
                    promptSlots.audio && `${promptSlots.audio} track${promptSlots.audio === 1 ? "" : "s"}`,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                .{" "}
                {slotGaps.length === 0 && attached.image + attached.video > 0
                  ? "All of them are attached below."
                  : "Add them below in that order — references are numbered as they are uploaded, not by what the files are called."}
              </p>
            )}
          </Step>
        )}

        {/* ---------- 1. concept ---------- */}
        {!blenderLane && (
        <Step n={STEP.concept} title="Pick a concept">
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AD_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                className={`rounded-[6px] border p-4 text-left transition ${
                  p.id === presetId
                    ? "border-accent bg-accent/[0.04] ring-1 ring-accent"
                    : "border-border-soft hover:border-accent/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{p.name}</h3>
                  <span className="chip shrink-0">{p.durationSeconds}s · {p.aspect}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.hook}</p>
              </button>
            ))}
          </div>
        </Step>
        )}

        {/* ---------- 2. product — first, because the photo fills in the recipe ---------- */}
        {!blenderLane && (
        <Step
          n={STEP.product}
          title="Your product"
          aside={
            <button
              className="text-xs font-semibold text-muted hover:text-foreground"
              onClick={loadExample}
            >
              or load an example
            </button>
          }
        >
          {/* Photo first — it drives everything below */}
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[6px] border border-border-soft bg-surface-2 p-4">
            {productImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productImage}
                alt="Product"
                className="h-16 w-16 rounded-[6px] border border-border-soft object-cover"
              />
            )}
            <button
              className="btn-secondary"
              onClick={() => fileInput.current?.click()}
              disabled={autofillBusy}
            >
              {autofillBusy
                ? "Reading the photo…"
                : productImage
                  ? "Replace product photo"
                  : "Upload product photo"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  try {
                    const dataUrl = await toProcessedDataUrl(f);
                    setProductImage(dataUrl);
                    void runAutofill(dataUrl, presetId);
                  } catch {
                    setError("Could not read that image");
                  }
                }
                e.target.value = "";
              }}
            />
            <p className="min-w-40 flex-1 text-xs text-muted">
              The photo fills the fields below (brand read off the pack, a
              background color reasoned from the packaging) and grounds the
              video as its first frame.
            </p>
          </div>

          {autofillRationale && (
            <div className="mt-3 rounded-[6px] border border-accent/30 bg-accent/5 p-3 text-xs leading-relaxed text-muted">
              <span className="font-bold text-accent">Filled from your photo.</span>{" "}
              {autofillRationale} Review every field — especially the price —
              before composing.
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {preset.fields.map((f) => (
              <label key={f.key}>
                <span className="mb-1 flex items-center gap-1.5 label">
                  {f.label}
                  {autofilledKeys.has(f.key) && (
                    <span className="rounded bg-accent/15 px-1 py-px text-[10px] font-bold normal-case tracking-normal text-accent">
                      from photo
                    </span>
                  )}
                  {f.key === "price" && productImage && !autofilledKeys.has("price") && (
                    <span className="rounded bg-warning/15 px-1 py-px text-[10px] font-bold normal-case tracking-normal text-warning">
                      not on pack — set it
                    </span>
                  )}
                </span>
                <input
                  className="input disabled:opacity-60"
                  placeholder={f.placeholder}
                  disabled={autofillBusy}
                  value={params[f.key] ?? ""}
                  onChange={(e) => {
                    setParams((prev) => ({ ...prev, [f.key]: e.target.value }));
                    setAutofilledKeys((prev) => {
                      if (!prev.has(f.key)) return prev;
                      const next = new Set(prev);
                      next.delete(f.key);
                      return next;
                    });
                  }}
                />
              </label>
            ))}
          </div>
        </Step>
        )}

        {/* ---------- 3. the recipe, now populated from the photo ---------- */}
        {!blenderLane && (
        <Step
          n={STEP.recipe}
          title={`The recipe — ${preset.name}`}
          aside={
            <div className="flex items-center gap-2">
              {recipeEdited && (
                <span className="chip border-accent/40 !text-accent">Edited</span>
              )}
              {recipeEdited && (
                <button
                  className="text-xs font-semibold text-muted hover:text-foreground"
                  onClick={() => {
                    setRecipe(editableRecipeOf(preset));
                    invalidatePrompt();
                  }}
                >
                  Reset to preset
                </button>
              )}
              <button
                className="btn-secondary !px-3 !py-1.5 text-xs"
                onClick={() => setEditingRecipe((v) => !v)}
              >
                {editingRecipe ? "Done editing" : "Edit recipe"}
              </button>
            </div>
          }
        >
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {presetId === CUSTOM_PRESET_ID
              ? "Write the concept in the four parts a video model actually reads: how it looks, what happens beat by beat, what text appears, and what it sounds like. Nothing here is required — the parts you leave blank are simply not sent."
              : editingRecipe
                ? "Change anything. An edited recipe is rebuilt into the prompt section by section — your beats, your sound design — instead of using the preset's hand-tuned paragraph."
                : "The concept, deconstructed into the four things a video model actually reads. Edit any of it to make the concept yours."}
          </p>

          {editingRecipe ? (
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div className="space-y-5">
                <label className="block">
                  <span className="mb-1 block label !text-accent">Core aesthetics</span>
                  <textarea
                    className="input min-h-32 text-sm leading-relaxed"
                    value={toLines(recipe.aesthetics)}
                    onChange={(e) => editRecipe({ aesthetics: fromLines(e.target.value) })}
                  />
                  <span className="mt-1 block text-xs text-muted">One per line.</span>
                </label>
                <label className="block">
                  <span className="mb-1 block label !text-accent">
                    Sound design {cap.native ? `(rendered by ${modelName})` : "(built in the edit)"}
                  </span>
                  <textarea
                    className="input min-h-28 text-sm leading-relaxed"
                    value={toLines(recipe.sfx)}
                    onChange={(e) => editRecipe({ sfx: fromLines(e.target.value) })}
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Effects and ambience only — music is set in step {STEP.sound}.
                  </span>
                </label>
              </div>
              <div className="space-y-5">
                <div>
                  <span className="mb-1 block label !text-accent">Action sequence</span>
                  <div className="space-y-2">
                    {recipe.scenes.map((sc, i) => (
                      <div key={i} className="rounded-[6px] border border-border-soft bg-surface-2 p-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-accent">{i + 1}</span>
                          <input
                            className="input !py-1 text-xs font-semibold"
                            value={sc.title}
                            placeholder="Beat name"
                            onChange={(e) =>
                              editRecipe({
                                scenes: recipe.scenes.map((x, j) =>
                                  j === i ? { ...x, title: e.target.value } : x,
                                ),
                              })
                            }
                          />
                          <button
                            className="shrink-0 font-mono text-xs text-danger"
                            aria-label={`Remove beat ${i + 1}`}
                            onClick={() =>
                              editRecipe({ scenes: recipe.scenes.filter((_, j) => j !== i) })
                            }
                          >
                            ✕
                          </button>
                        </div>
                        <textarea
                          className="input mt-1.5 min-h-14 text-xs leading-relaxed"
                          value={sc.description}
                          placeholder="What happens in this beat"
                          onChange={(e) =>
                            editRecipe({
                              scenes: recipe.scenes.map((x, j) =>
                                j === i ? { ...x, description: e.target.value } : x,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-secondary mt-2 !px-3 !py-1.5 text-xs"
                    onClick={() =>
                      editRecipe({
                        scenes: [...recipe.scenes, { title: "", description: "" }],
                      })
                    }
                  >
                    Add a beat
                  </button>
                </div>
                <label className="block">
                  <span className="mb-1 block label !text-accent">Text overlay</span>
                  <textarea
                    className="input min-h-20 text-sm leading-relaxed"
                    value={recipe.overlay}
                    onChange={(e) => editRecipe({ overlay: e.target.value })}
                  />
                  <span className="mt-1 block text-xs text-muted">
                    Describe placement and timing; the actual words come from your
                    product fields in step {STEP.product}.
                  </span>
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              <div>
                <p className="label !text-accent">Core aesthetics</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                  {recipe.aesthetics.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                <p className="mt-4 label !text-accent">
                  Sound design {cap.native ? `(rendered by ${modelName})` : "(built in the edit)"}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                  {recipe.sfx.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="label !text-accent">Action sequence</p>
                <ol className="mt-2 space-y-2">
                  {recipe.scenes.map((s, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-semibold">
                        {i + 1} · {s.title}:
                      </span>{" "}
                      <span className="text-muted">{s.description}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 label !text-accent">Text overlay</p>
                <p className="mt-2 text-sm text-muted">{recipe.overlay}</p>
              </div>
            </div>
          )}
        </Step>
        )}

        {/* ---------- 4. references — what the recipe just asked for ---------- */}
        {supportsRefs && (
          <Step
            n={STEP.refs}
            title={blenderLane ? "References — the clay pass and the look" : "References"}
            aside={
              <div className="flex items-center gap-3">
                <span className="label-sm">
                  {(productImage ? 1 : 0) + refs.length + (timingRefActive ? 1 : 0)} of{" "}
                  {REF_CEILINGS.total}
                </span>
                {(productImage || refs.length > 0) && (
                  <button
                    className="text-xs font-semibold text-accent hover:underline disabled:opacity-50"
                    onClick={() => void checkRefs()}
                    disabled={checkingRefs}
                  >
                    {checkingRefs ? "Checking…" : "Check references"}
                  </button>
                )}
              </div>
            }
          >
            {refCheck && (
              <div
                className={`mt-4 rounded-[6px] border p-4 ${
                  refCheck.every((f) => f.ok)
                    ? "border-success/40 bg-success/10"
                    : "border-warning/50 bg-warning/10"
                }`}
              >
                <p className={`label ${refCheck.every((f) => f.ok) ? "!text-success" : "!text-warning"}`}>
                  {refCheck.every((f) => f.ok)
                    ? "Every reference is reachable and within limits"
                    : `${refCheck.filter((f) => !f.ok).length} reference${
                        refCheck.filter((f) => !f.ok).length === 1 ? "" : "s"
                      } would be rejected`}
                </p>
                <ul className="mt-3 space-y-2.5">
                  {refCheck.map((f, i) => (
                    <li key={i} className="text-xs leading-relaxed">
                      <span className="font-mono font-semibold text-accent">{f.slot}</span>{" "}
                      <span className={f.ok ? "text-success" : "text-warning"}>{f.ok ? "✓" : "✕"}</span>
                      {f.detail?.width && f.detail?.height && (
                        <span className="text-muted">
                          {" "}
                          · {f.detail.width}×{f.detail.height}
                          {f.detail.bytes
                            ? ` · ${
                                f.detail.bytes >= 1024 * 1024
                                  ? `${(f.detail.bytes / 1024 / 1024).toFixed(1)}MB`
                                  : `${Math.round(f.detail.bytes / 1024)}KB`
                              }`
                            : ""}
                        </span>
                      )}
                      {[...f.problems, ...f.notes].map((line, j) => (
                        <span key={j} className="mt-0.5 block text-muted">
                          {line}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                {!refCheck.every((f) => f.ok) && (
                  <p className="mt-3 border-t border-warning/30 pt-2 text-xs leading-relaxed text-muted">
                    These are the causes the provider reports as a content-policy
                    failure without naming. Clearing them first is cheaper than
                    another rejected submit.
                  </p>
                )}
              </div>
            )}
            {/*
              In the Blender lane the preset's reference recipe is the wrong
              checklist — it describes a concept nobody chose. What matters
              instead is that the files go in the order the prompt numbers
              them, because the surface indexes by upload order and nothing
              tells you when that is off by one.
            */}
            {blenderLane && (
              <div className="mt-4 rounded-[6px] border border-accent/30 bg-accent/[0.04] p-4">
                <p className="label !text-accent">Upload in prompt order</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Order is the only thing here the model reads. The job
                  dropdown on each reference feeds the recipe composer, which
                  this lane skips — what each slot is for is already stated in
                  your prompt&apos;s{" "}
                  <span className="font-mono text-[11px]">[Reference roles]</span>{" "}
                  block.
                </p>
                <ol className="mt-3 space-y-2">
                  <li className="flex gap-3 text-xs leading-relaxed">
                    <span className="font-mono font-semibold text-accent">[Video1]</span>
                    <span className="min-w-0 text-muted">
                      <span className="font-semibold text-foreground">The clay control pass.</span>{" "}
                      Camera, blocking, timing, occlusion order and light
                      direction come from here — which is why nothing in this
                      lane asks you to describe them.
                    </span>
                  </li>
                  <li className="flex gap-3 text-xs leading-relaxed">
                    <span className="whitespace-nowrap font-mono font-semibold text-accent">
                      [Image1…{Math.max(promptSlots.image, 1)}]
                    </span>
                    <span className="min-w-0 text-muted">
                      <span className="font-semibold text-foreground">The look references</span>, one
                      per mapped ID colour, in the same order the prompt names
                      them. Stills and clips are numbered in separate series,
                      so the clay pass does not consume [Image1].
                    </span>
                  </li>
                </ol>
                <p className="mt-3 border-t border-accent/20 pt-2 text-xs leading-relaxed text-muted">
                  Bind by token, never by filename. The model resolves
                  references positionally and has never seen what your file is
                  called.
                </p>
              </div>
            )}

            {/* Reference recipe — the concept ships with instructions */}
            {!blenderLane && preset.referenceRecipe && (
              <details open className="mt-4 rounded-[6px] border border-accent/30 bg-accent/[0.04] p-3">
                <summary className="cursor-pointer text-xs font-semibold text-accent">
                  Reference recipe for {preset.name} — what to add, and why
                </summary>
                <ol className="mt-3 grid gap-3 md:grid-cols-2">
                  {recipeChecklist.map(({ step, satisfied }, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] ${
                          satisfied
                            ? "bg-success text-white"
                            : step.impact === "critical"
                              ? "bg-warning text-white"
                              : "border border-border-strong text-muted"
                        }`}
                      >
                        {satisfied ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold leading-snug">
                          {step.what}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">
                            {step.media === "video" ? "clip" : step.media === "audio" ? "track" : "still"} ·{" "}
                            {REFERENCE_ROLES.find((r) => r.id === step.role)?.label}
                          </span>
                          {step.impact === "critical" && !satisfied && (
                            <span className="rounded-full bg-warning/15 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.1em] text-warning">
                              Do this one
                            </span>
                          )}
                          {step.impact === "optional" && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted">
                              optional
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">
                          {step.why}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 border-t border-accent/20 pt-2 text-xs leading-relaxed text-muted">
                  Order matters: references are numbered as you add them, and
                  the prompt addresses them by that number. Add the product
                  first.
                </p>
              </details>
            )}

            {/*
              The add controls, at the top of the step and in their own frame.
              They used to sit below the starter-clip gallery, which put the
              main action of the step a scroll away from its heading and left
              anything you added rendering off-screen above you — so an upload
              looked like it had done nothing. Controls first, then what you
              have attached, then the gallery you can borrow from.
            */}
            <div className="mt-4 rounded-[6px] border border-accent/40 bg-accent/[0.04] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="label !text-accent">Add your references</span>
                <span className="text-[11px] text-muted">
                  Upload a file, or paste a direct link to one
                </span>
              </div>
              <button
                className="btn-primary"
                onClick={() => refInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading…" : "Add reference (image, clip or track)"}
              </button>
              <input
                ref={refInput}
                type="file"
                accept={REF_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void addReference(f);
                  e.target.value = "";
                }}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  className="input min-w-0 flex-1 basis-64 font-mono text-xs"
                  placeholder="…or paste a direct URL — https://example.com/camera-move.mp4"
                  value={refUrl}
                  onChange={(e) => setRefUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addReferenceUrl();
                    }
                  }}
                />
                <button
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={addReferenceUrl}
                  disabled={!refUrl.trim()}
                >
                  Add from URL
                </button>
              </div>

              {/* Reference failures belong here, next to the button that caused
                  them — not in the page banner far above. */}
              {refError && (
                <p
                  role="alert"
                  className="mt-3 rounded-[6px] border border-danger/50 bg-danger/10 p-3 text-sm leading-relaxed text-danger"
                >
                  {refError}
                </p>
              )}

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip">
                  Stills · JPG, PNG, WebP · up to {REF_CEILINGS.image}
                </span>
                <span
                  className={`chip ${clipsUploadable ? "border-warning/40 !text-warning" : "opacity-55"}`}
                >
                  Clips · {VIDEO_REF_LIMITS.formats} · ≤
                  {health?.blob ? VIDEO_REF_LIMITS.maxMBDirect : VIDEO_REF_LIMITS.maxMB}MB ·{" "}
                  ~{VIDEO_REF_LIMITS.idealSeconds}s
                </span>
                <span
                  className={`chip ${clipsUploadable ? "border-warning/40 !text-warning" : "opacity-55"}`}
                >
                  Tracks · {AUDIO_REF_LIMITS.formats} · ≤
                  {health?.blob ? AUDIO_REF_LIMITS.maxMBDirect : AUDIO_REF_LIMITS.maxMB}MB
                </span>
              </div>

              {!clipsUploadable && (
                <p className="mt-2 max-w-3xl rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                  <span className="font-bold">Uploads need live mode.</span>{" "}
                  Images are processed in your browser, but clips and tracks are
                  uploaded to the generation provider. Use the{" "}
                  <span className="font-semibold">Demo mode · Unlock</span> button
                  at the top of this page — or paste a URL in the field above,
                  which skips the upload entirely.
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-foreground">
                  Uploading and pasting a URL are different paths — how, and which to use
                </summary>
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">
                    Uploading and pasting a URL are different paths.
                  </span>{" "}
                  {health?.blob
                    ? "An upload goes from your browser straight to this site's Blob store and comes back as a permanent URL — it never passes through a server function, which is what lifts the size ceiling. "
                    : "An upload goes through fal's storage service, which is permissioned separately from generation — so a key that renders video fine can still be refused a file upload. "}
                  A URL is handed
                  straight to the model, so it needs no upload, no live mode and no
                  storage access. It has to be a direct link to the file (ending in
                  .mp4, .mov, .mp3…) that fal can reach without signing in.
                </p>
                {/*
                  Worth its own paragraph because the two paths fail differently
                  for stills, and the difference is invisible until a paid render
                  is rejected. A URL-added still is one more thing the provider has
                  to reach across the internet; an uploaded one is carried inside
                  the request and cannot fail that way.
                */}
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">
                    For stills specifically, uploading is the more reliable path.
                  </span>{" "}
                  An uploaded image is resized and carried inside the request
                  itself, so nothing has to fetch it. A pasted image URL is fetched
                  by the generation provider at render time — and when that fetch
                  fails, the provider does not report a missing file. It reports a
                  content-policy violation about the imagery, which sends you
                  looking for a problem in a picture that was never opened. Use{" "}
                  <span className="font-semibold text-foreground">Check references</span>{" "}
                  above before spending if your stills came from a URL.
                </p>
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
                  Add more angles of the product to tighten the identity lock, a
                  still to borrow a palette from, a <strong>short clip</strong>{" "}
                  whose camera move and cut rhythm you want imitated, or a{" "}
                  <strong>track</strong> whose beats the action should land on. Each
                  gets a job in the prompt — set it in the dropdown.{" "}
                  <strong>Trim clips before uploading</strong> — these models read
                  the camera move, not the content, so anything past a few seconds
                  costs upload time and buys nothing.
                </p>
              </details>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {productImage && (
                <div className="flex items-center gap-3 rounded-[6px] border border-accent/40 bg-accent/[0.05] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImage}
                    alt="Product reference"
                    className="h-10 w-10 rounded-[4px] border border-border-soft object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-accent">[Image1]</p>
                    <p className="text-xs text-muted">
                      Product identity — from your product photo
                    </p>
                  </div>
                </div>
              )}

              {refs.map((r, i) => {
                // Tokens are numbered per media type, matching how the
                // model resolves them.
                const priorSameMedia = refs
                  .slice(0, i)
                  .filter((x) => x.media === r.media).length;
                const n =
                  r.media === "image"
                    ? (productImage ? 2 : 1) + priorSameMedia
                    : 1 + priorSameMedia;
                const token =
                  r.media === "image"
                    ? `[Image${n}]`
                    : r.media === "video"
                      ? `[Video${n}]`
                      : `[Audio${n}]`;
                const allowed = REFERENCE_ROLES.filter((o) =>
                  (o.media as readonly string[]).includes(r.media),
                );
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-[6px] border border-border-soft bg-surface p-2"
                  >
                    {r.media === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.url}
                        alt=""
                        className="h-10 w-10 rounded-[4px] border border-border-soft object-cover"
                      />
                    ) : r.media === "video" ? (
                      <video
                        src={r.url}
                        muted
                        playsInline
                        className="h-10 w-10 rounded-[4px] border border-border-soft object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-border-soft bg-surface-2 text-base">
                        ♪
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-accent">
                        {token}
                        <span className="ml-1.5 text-muted">
                          {r.media === "video" ? "clip" : r.media === "audio" ? "track" : "still"}
                        </span>
                      </p>
                      {/*
                        The role feeds the prompt composer, and nothing else —
                        it is not sent with the render. In the Blender lane
                        there is no composer, so the dropdown is a label for
                        the person and the [Reference roles] block in the
                        prompt is what the model actually reads. Saying so
                        beats leaving a control that looks load-bearing.
                      */}
                      <select
                        aria-label={`Job for ${token}`}
                        title={
                          blenderLane
                            ? "A label for you — your prompt's [Reference roles] block is what the model reads."
                            : "Sets how the composer describes this reference in the prompt."
                        }
                        className="mt-0.5 w-full bg-transparent text-xs text-muted outline-none"
                        value={r.role}
                        onChange={(e) => {
                          const role = e.target.value as ReferenceRole;
                          setRefs((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, role } : x)),
                          );
                          invalidatePrompt();
                        }}
                      >
                        {allowed.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="font-mono text-xs text-danger"
                      onClick={() => {
                        setRefs((prev) => prev.filter((_, j) => j !== i));
                        invalidatePrompt();
                      }}
                      aria-label="Remove reference"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {timingRefActive && (
                <div className="flex items-center gap-3 rounded-[6px] border border-accent/40 bg-accent/[0.05] p-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-border-soft bg-surface-2 text-base">
                    ♪
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[11px] text-accent">
                      [Audio{refs.filter((r) => r.media === "audio").length + 1}]
                      <span className="ml-1.5 text-muted">track</span>
                    </p>
                    <p className="text-xs text-muted">
                      Musical timing — your composed bed, from step {STEP.sound}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Starter clips — motion you can borrow without shooting it. */}
            <div className="mt-5 border-t border-border-soft pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="label">Starter motion clips</span>
                <span className="label-sm">or add your own above</span>
              </div>
              <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-muted">
                Abstract on purpose. The model reads a clip&apos;s camera move,
                cutting rhythm and energy and applies them to your product, so
                a reference with no subject in it has nothing to leak into the
                render — only motion.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {REFERENCE_CLIPS.map((clip) => {
                  const ready = availableClipIds.includes(clip.id);
                  // The manifest path is only a default; the server may have
                  // resolved this clip to a hosted URL instead.
                  const src = clipSources[clip.id] ?? clip.file;
                  const added = refs.some((r) => r.url === src);
                  return (
                    <div
                      key={clip.id}
                      className={`rounded-[6px] border ${
                        added ? "border-accent bg-accent/[0.04]" : "border-border-soft bg-surface"
                      }`}
                    >
                      <div className="relative aspect-video overflow-hidden rounded-t-[5px] bg-surface-2">
                        {ready ? (
                          <ClipPreview src={src} poster={clip.poster} />
                        ) : (
                          <div className="flex h-full items-center justify-center px-2 text-center">
                            <span className="label-sm !text-[10px]">Not added yet</span>
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold">{clip.name}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted">
                          {clip.brief}
                        </p>
                        <button
                          className="btn-secondary mt-2.5 w-full !px-2 !py-1 text-[11px]"
                          disabled={!ready || added}
                          onClick={() => {
                            setRefs((prev) => [
                              ...prev,
                              {
                                url: src,
                                media: "video",
                                role: clip.suggestedRole as ReferenceRole,
                                name: clip.name,
                              },
                            ]);
                            invalidatePrompt();
                          }}
                        >
                          {added ? "Added" : ready ? "Use as reference" : "Unavailable"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableClipIds.length === 0 && (
                <p className="mt-3 max-w-3xl rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                  <span className="font-bold">No starter clips installed.</span>{" "}
                  Two ways to add them. Host the files anywhere public and set{" "}
                  <code className="font-mono">REFERENCE_CLIP_VIBRANT_CHURN</code>{" "}
                  and friends to their URLs, which keeps multi-megabyte video
                  out of the repo entirely. Or commit the four files to{" "}
                  <code className="font-mono">public/references/</code> under the
                  names above. Either way they cost nothing per use and never
                  expire, unlike an upload — and either way the value is read at
                  build time, so a new clip needs a redeploy, not just a
                  restart.
                </p>
              )}
            </div>

          </Step>
        )}

        {/* ---------- 7. compose ---------- */}
        {/* ---------- 5. format — after references, which change the bill ---------- */}
        <Step
          n={STEP.format}
          title="Format and cost"
          aside={
            <span className="chip border-accent/40 !text-accent">
              {frame.width}×{frame.height} · {duration}s · ~${videoCost.toFixed(2)}
            </span>
          }
        >
          <label className="mt-4 block">
            <span className="mb-1 block label">Video model</span>
            <select
              className="input"
              value={modelId}
              onChange={(e) => {
                setModelId(e.target.value);
                setSeconds(null);
                invalidatePrompt();
              }}
            >
              {AD_VIDEO_MODELS.map((m) => (
                <option key={m} value={m}>
                  {MODELS[m].label} —{" "}
                  {usesTokenPricing(m)
                    ? `~$${MODELS[m].unitCost}/s at 720p, by token`
                    : `$${MODELS[m].unitCost}/s`}
                </option>
              ))}
            </select>
            <span className="mt-2 block max-w-3xl text-xs leading-relaxed text-muted">
              {supportsRefs
                ? "Reference-to-video: every uploaded reference is addressed positionally in the prompt ([Image1], [Video1], [Audio1]…), which is what stops the product drifting as the camera moves."
                : "Single grounding frame: the product photo conditions the first frame, then the model extrapolates. Cheaper, but the pack can drift as the camera moves."}
            </span>
          </label>

          {/* Shape — one concept usually has to ship in several. */}
          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="label">Shape</span>
              {aspectChanged && (
                <span className="label-sm !text-warning">
                  Preset was designed for {preset.aspect}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {allowedAspects.map((a) => {
                const active = aspect === a.id;
                const r = aspectRatioValue(a.id);
                return (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAspectOverride(a.id);
                      invalidatePrompt();
                    }}
                    title={a.use}
                    className={`flex items-center gap-2.5 rounded-[6px] border px-3 py-2 text-left transition ${
                      active
                        ? "border-accent bg-accent/[0.05]"
                        : "border-border-soft bg-surface hover:border-accent/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`shrink-0 rounded-[2px] border ${active ? "border-accent bg-accent/25" : "border-border-strong"}`}
                      style={{
                        width: r >= 1 ? 26 : Math.round(26 * r),
                        height: r >= 1 ? Math.round(26 / r) : 26,
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold leading-tight">
                        {a.label}
                      </span>
                      <span className="block text-[11px] leading-tight text-muted">
                        {a.use}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {allowedAspects.length < ASPECTS.length && (
              <p className="mt-2 text-xs text-muted">
                {modelName} renders {allowedAspects.length} shapes. Seedance 2.5
                adds square, portrait, 4:3 and cinematic — useful when one
                concept has to ship as a vertical and a feed tile.
              </p>
            )}
          </div>

          {/* Length */}
          <label className="mt-5 block max-w-md">
            <span className="mb-1 flex items-center justify-between label">
              <span>Length</span>
              <span className="!text-foreground">{duration}s</span>
            </span>
            <input
              type="range"
              min={4}
              max={secondsCap}
              step={1}
              value={duration}
              onChange={(e) => setSeconds(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              {secondsCap >= 30
                ? "Seedance 2.5 renders up to 30s in a single pass — no stitching."
                : `This model caps at ${secondsCap}s.`}{" "}
              The concept is designed for {preset.durationSeconds}s.
            </span>
          </label>

          {/* Resolution + live cost */}
          {tokenBilled ? (
            <div className="mt-5 border-t border-border-soft pt-4">
              <span className="label">Resolution — the real cost lever</span>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                {allowedResolutions.map((r) => {
                  const at = estimateCost(modelId, {
                    seconds: duration,
                    resolution: r.id,
                    aspect,
                    hasVideoInputs: inputVideoSeconds > 0,
                    inputVideoSeconds,
                  });
                  const size = frameSize(r.id, aspect);
                  return (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-[6px] border p-3 transition ${
                        resolution === r.id
                          ? "border-accent bg-accent/[0.04]"
                          : "border-border-soft bg-surface hover:border-accent/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="resolution"
                        className="mt-1 accent-[var(--accent)]"
                        checked={resolution === r.id}
                        onChange={() => setResolution(r.id)}
                      />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-semibold">{r.label}</span>
                          <span className="font-mono text-[11px] text-accent">
                            ~${at.toFixed(2)}
                          </span>
                        </span>
                        <span className="mt-0.5 block font-mono text-[10px] text-muted">
                          {size.width}×{size.height}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">
                          {r.note}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <details className="mt-3 rounded-[6px] border border-border-soft bg-surface-2 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-foreground">
                  How this is priced — {frame.width}×{frame.height} × {duration}s
                  = ~${videoCost.toFixed(2)}
                </summary>
                <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">
                    Seedance bills by token, not by second.
                  </span>{" "}
                  Tokens ≈ width × height × seconds × 24 ÷ 1024, so pixel area
                  matters as much as length. That is why the shape you pick
                  changes the price as well as the crop: at the same resolution
                  a 21:9 frame has more than twice the pixels of a 1:1 one.
                  1080p is also billed at a higher rate per token on top of
                  having four times the pixels of 480p. Draft at 480p until the
                  take is right.
                  {inputVideoSeconds > 0 && (
                    <>
                      {" "}
                      Your {refs.filter((r) => r.media === "video").length} clip
                      reference
                      {refs.filter((r) => r.media === "video").length === 1
                        ? ""
                        : "s"}{" "}
                      add billed duration too, discounted by 0.6.
                    </>
                  )}
                </p>
              </details>
            </div>
          ) : (
            <p className="mt-5 border-t border-border-soft pt-4 text-xs leading-relaxed text-muted">
              {modelName} is billed per second — ${MODELS[modelId].unitCost}/s ×{" "}
              {duration}s = <span className="font-bold text-accent">${videoCost.toFixed(2)}</span>.
              Resolution is fixed by the model, so shape and length are the only
              cost levers here. Seedance 2.5 exposes resolution as a third one.
            </p>
          )}
        </Step>

        {/* ---------- 6. sound — the bed is cut to the duration set above ---------- */}
        <Step
          n={STEP.sound}
          title="Sound"
          aside={
            <span
              className={`chip ${cap.native ? "border-success/40 !text-success" : "border-warning/40 !text-warning"}`}
            >
              {cap.native ? "Native audio" : "Silent model"}
            </span>
          }
        >
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            <span className="font-semibold text-foreground">{modelName}:</span>{" "}
            {cap.note}
          </p>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            {audioChoices.map((c) => (
              <label
                key={c.id}
                className={`flex cursor-pointer items-start gap-2 rounded-[6px] border p-3 transition ${
                  audioMode === c.id
                    ? "border-accent bg-accent/[0.04]"
                    : "border-border-soft bg-surface hover:border-accent/40"
                }`}
              >
                <input
                  type="radio"
                  name="audioMode"
                  className="mt-1 accent-[var(--accent)]"
                  checked={audioMode === c.id}
                  onChange={() => {
                    setAudioMode(c.id);
                    invalidatePrompt();
                  }}
                />
                <span>
                  <span className="text-sm font-semibold leading-snug">{c.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {c.body}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {audioMode !== "silent" && (
            <label className="mt-4 block max-w-md">
              <span className="mb-1 block label">Music style</span>
              <select
                className="input"
                value={musicStyleId}
                onChange={(e) => {
                  setMusicStyleId(e.target.value);
                  setMusicUrl(null);
                  // In native mode the brief is written into the video prompt.
                  if (audioMode === "native") invalidatePrompt();
                }}
              >
                {MUSIC_STYLES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                {audioMode === "native"
                  ? `This brief is written into the video prompt for ${modelName} to interpret.`
                  : `This brief is sent to ${MODELS[MUSIC_MODEL_ID].label} as its own composition.`}
                {audioMode === "layered" && (
                  <>
                    {" "}
                    It runs as an endpoint on fal and bills to the same fal key
                    as the video — there is no separate ElevenLabs account to
                    connect, and the fal.ai status at the top of the page covers
                    it.
                  </>
                )}
              </span>
              {musicStyleId !== NO_MUSIC_ID && (
                <details className="mt-2 rounded-[6px] border border-border-soft bg-surface-2 p-2.5">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">
                    The brief this sends
                  </summary>
                  <span className="mt-1.5 block text-xs leading-relaxed text-muted">
                    {MUSIC_STYLES.find((m) => m.id === musicStyleId)?.prompt}
                  </span>
                </details>
              )}
            </label>
          )}

          {/* Spot effects — available whenever effects are being built outside
              the video model, which is both layered and silent. */}
          {scoringSeparately && (
            <div className="mt-4 border-t border-border-soft pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => void generateMusic()}
                  disabled={musicBusy}
                >
                  {musicBusy
                    ? "Composing…"
                    : musicUrl
                      ? "Regenerate music"
                      : `Generate music (${duration + MUSIC_HANDLE_SECONDS}s, ~$${musicCost.toFixed(2)})`}
                </button>
                {musicUrl && <span className="chip border-success/40 !text-success">track ready</span>}
              </div>

              {musicUrl && (
                <div className="mt-3 max-w-md">
                  <audio src={musicUrl} controls className="w-full" />
                  <a
                    href={musicUrl}
                    download={`${preset.id}-music`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                  >
                    Download track
                  </a>
                  <p className="mt-1 text-xs text-muted">
                    Generated {MUSIC_HANDLE_SECONDS}s longer than the cut for
                    trim handles — slide a downbeat onto the price stamp in
                    the edit.
                  </p>
                </div>
              )}

              {/* The Seedance-only move: the bed becomes an input. */}
              {timingRefAvailable && (
                <div
                  className={`mt-4 rounded-[6px] border p-3 ${
                    musicAsTimingRef
                      ? "border-accent/50 bg-accent/[0.05]"
                      : "border-border-soft bg-surface-2"
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[var(--accent)]"
                      checked={musicAsTimingRef}
                      onChange={(e) => {
                        setMusicAsTimingRef(e.target.checked);
                        invalidatePrompt();
                      }}
                    />
                    <span>
                      <span className="text-sm font-semibold">
                        Cut the picture to this track ({modelName} only)
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        The bed is handed back to the model as{" "}
                        <span className="font-mono text-accent">[Audio1]</span>{" "}
                        and read as a timing signal in the same pass that makes
                        the picture. This is the difference between beats you
                        nudge into place afterwards and cuts the render was
                        built around.
                      </span>
                    </span>
                  </label>
                  {musicAsTimingRef && !musicUrl && (
                    <p className="mt-2 rounded-[6px] border border-warning/40 bg-warning/10 p-2 text-xs leading-relaxed text-warning">
                      Compose the bed first — the reference has to exist before
                      the render starts.
                    </p>
                  )}
                  {musicAsTimingRef && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-semibold text-foreground">
                        What this does and doesn&apos;t do
                      </summary>
                      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
                        {TIMING_REF_NOTES.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {preset.beatSensitive && !timingRefActive && (
                <p className="mt-3 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                  <span className="font-bold">Beat-sensitive concept.</span>{" "}
                  This preset cuts its action to a musical pulse, but the bed
                  is composed without the model seeing it — the beats will not
                  line up on their own.{" "}
                  {cap.refAudio
                    ? "Tick the box above to hand the track back as a timing reference, or budget an alignment pass in the editor."
                    : "Budget an alignment pass in the editor, switch to Seedance 2.5 Reference to feed the track back as a timing signal, or pick a pad-like style that hides drift."}
                </p>
              )}

              {!timingRefActive && (
                <details className="mt-3 rounded-[6px] border border-border-soft bg-surface-2 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">
                    What layered audio does and doesn&apos;t guarantee
                  </summary>
                  <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                    {SYNC_CAVEATS.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {audioMode !== "native" && recipe.sfx.length > 0 && (
            <details className="group mt-4 border-t border-border-soft pt-4">
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span className="flex items-baseline gap-2 text-sm font-semibold">
                  <span
                    aria-hidden
                    className="font-mono text-[10px] text-accent transition group-open:rotate-90"
                  >
                    ▶
                  </span>
                  Spot effects — {MODELS[SFX_MODEL_ID].label.split(" (")[0]}
                </span>
                <span className="label-sm">
                  {Object.keys(sfxTracks).length} of {recipe.sfx.length} generated ·
                  ~${sfxCost.toFixed(3)} each
                </span>
              </summary>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                {cap.native && audioMode === "layered"
                  ? `${modelName} already renders effects from the picture it is making, which is why they land on the right frame — but it approximates a described effect rather than producing it. These are the hero hits: generated exactly as described, delivered as separate files, and placed by you in the edit.`
                  : `${modelName} gives you no audio here, so these are the effects track. Each one is a separate file you place in the edit.`}{" "}
                One event per generation.
              </p>

              <label className="mt-3 flex flex-wrap items-center gap-3">
                <span className="label">Length</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={sfxSeconds}
                  onChange={(e) => setSfxSeconds(Number(e.target.value))}
                  className="w-40 accent-[var(--accent)]"
                />
                <span className="font-mono text-xs text-foreground">{sfxSeconds}s</span>
                <span className="text-xs text-muted">
                  Long enough for the hit plus its tail; the model accepts{" "}
                  {SFX_LIMITS.minSeconds}–{SFX_LIMITS.maxSeconds}s.
                </span>
              </label>

              <ul className="mt-3 space-y-2">
                {recipe.sfx.map((line, i) => (
                  <li
                    key={i}
                    className="rounded-[6px] border border-border-soft bg-surface p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 basis-64 text-xs leading-relaxed text-muted">
                        {line}
                      </p>
                      <button
                        className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs"
                        onClick={() => void generateSfx(line)}
                        disabled={sfxBusy !== null}
                      >
                        {sfxBusy === line
                          ? "Generating…"
                          : sfxTracks[line]
                            ? "Regenerate"
                            : "Generate effect"}
                      </button>
                    </div>
                    {sfxTracks[line] && (
                      <div className="mt-2">
                        <audio src={sfxTracks[line]} controls className="h-9 w-full max-w-sm" />
                        <a
                          href={sfxTracks[line]}
                          download={`${preset.id}-sfx-${i + 1}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-accent hover:underline"
                        >
                          Download effect {i + 1}
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                These lines come from the recipe&apos;s sound design — edit them
                {blenderLane
                  ? " in your prompt to change what gets generated."
                  : ` in step ${STEP.recipe} to change what gets generated.`}
              </p>

              <details className="mt-3 rounded-[6px] border border-border-soft bg-surface-2 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-foreground">
                  How the layers stack, and how to describe an effect
                </summary>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                  {LAYER_NOTES.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <p className="mt-3 label !text-accent">Describing an effect</p>
                <ul className="mt-1 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                  {SFX_PROMPT_TIPS.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </details>
            </details>
          )}
        </Step>

        {!blenderLane && (
        <Step
          n={STEP.prompt}
          title="Compose the prompt"
          aside={importControl}
        >
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
            {recipeEdited
              ? "Your edited recipe is rebuilt into a prompt section by section, then polished for the target duration. Nothing is generated yet — read it before you spend."
              : "The recipe, your product fields and every reference job are compiled into one prompt, then polished for the target duration. Nothing is generated yet — read it before you spend."}
          </p>
          <button
            className="btn-primary mt-4"
            onClick={() => void compose()}
            disabled={phase === "composing" || autofillBusy}
          >
            {phase === "composing"
              ? "Composing…"
              : productImage
                ? "Compose from photo + fields →"
                : "Compose the prompt →"}
          </button>

          {imported && (
            <p className="mt-4 rounded-[6px] border border-accent/30 bg-accent/[0.05] p-3 text-xs leading-relaxed text-muted">
              <span className="font-bold text-accent">From the prompt library.</span>{" "}
              Loaded to run as-is, with the length it was written for. It has
              no recipe behind it and no references attached yet — attach them
              in the References step so its tokens resolve, and note that
              composing from the recipe above will replace it.
            </p>
          )}
          {finalPrompt && (
            <>
              <label className="mt-5 block">
                <span className="mb-1 block label">Video prompt — edit before you spend</span>
                <textarea
                  className="input min-h-40 font-mono text-xs leading-relaxed"
                  value={finalPrompt}
                  onChange={(e) => setFinalPrompt(e.target.value)}
                />
              </label>
              <label className="mt-3 block">
                <span className="mb-1 block label">Negative prompt</span>
                <input
                  className="input font-mono text-xs"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                />
              </label>
            </>
          )}
        </Step>
        )}

        {/* ---------- 8. generate ---------- */}
        <Step n={STEP.generate} title="Generate">
          {blenderLane && slotGaps.length > 0 && (
            <div className="mt-4 rounded-[6px] border border-warning/50 bg-warning/10 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
                Before you spend ${cost.toFixed(2)}
              </p>
              <p className="mt-1.5 text-xs font-semibold leading-snug text-foreground">
                The prompt addresses references that are not attached.
              </p>
              <ul className="mt-2 space-y-1.5">
                {slotGaps.map((g) => (
                  <li key={g.kind} className="text-xs leading-relaxed text-muted">
                    It refers to{" "}
                    <span className="font-mono font-semibold text-foreground">
                      [{g.kind === "image" ? "Image" : g.kind === "video" ? "Video" : "Audio"}
                      {g.wants}]
                    </span>
                    , but {g.has === 0 ? "no" : `only ${g.has}`}{" "}
                    {g.kind === "image" ? "still" : g.kind === "video" ? "clip" : "track"}
                    {g.has === 1 ? " is" : "s are"} attached.{" "}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                An unresolved token is read as prose rather than rejected — the
                render comes back looking fine and built on nothing.
              </p>
            </div>
          )}
          {!blenderLane && unmet.length > 0 && (
            <div className="mt-4 rounded-[6px] border border-warning/50 bg-warning/10 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-warning">
                Before you spend ${cost.toFixed(2)}
              </p>
              <p className="mt-1.5 text-xs font-semibold leading-snug text-foreground">
                {unmet.length === 1
                  ? "One high-impact reference is missing."
                  : `${unmet.length} high-impact references are missing.`}
              </p>
              <ul className="mt-2 space-y-2">
                {unmet.map((step, i) => (
                  <li key={i} className="text-xs leading-relaxed text-muted">
                    <span className="font-semibold text-foreground">{step.what}</span>{" "}
                    {step.ifMissing ?? step.why}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Adding these costs nothing. Generating without them usually
                costs the price of a second take.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-muted">
              {duration}s · {aspect} · {frame.width}×{frame.height} ·{" "}
              <span className="font-bold text-accent">~${cost.toFixed(2)}</span>
              {scoringSeparately && (
                <span className="block text-xs">
                  video ${videoCost.toFixed(2)} + music ${musicCost.toFixed(2)}
                </span>
              )}
              {health && !health.live && (
                <span className="ml-1 text-xs text-warning">(demo — $0)</span>
              )}
            </div>
            <button
              className={flagged ? "btn-secondary !border-warning !text-warning" : "btn-primary"}
              disabled={
                !finalPrompt || blockedOnMusic || phase === "starting" || phase === "polling"
              }
              onClick={() => void generate()}
            >
              {flagged ? "Generate anyway →" : "Generate ad →"}
            </button>
          </div>
          {!finalPrompt && (
            <p className="mt-2 text-xs text-muted">Compose the prompt first.</p>
          )}
          {finalPrompt && blockedOnMusic && (
            <p className="mt-2 text-xs text-warning">
              Compose the music bed in step {STEP.sound} — the render is set to cut against it.
            </p>
          )}
        </Step>

        {(phase === "starting" || phase === "polling" || phase === "done" || phase === "mock" || phase === "failed") && (
          <div className="card overflow-hidden">
            <div className="mx-auto w-full max-w-md">
              <div className={`relative w-full bg-surface-2 ${ASPECT_CLASS[aspect] ?? "aspect-[16/9]"}`}>
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover"
                    onPlay={() => syncAudio("play")}
                    onPause={() => syncAudio("pause")}
                    onSeeked={() => syncAudio("seek")}
                    onEnded={() => syncAudio("pause")}
                  />
                ) : posterDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterDataUrl}
                    alt={preset.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted">
                    {phase === "failed" ? (
                      <div className="max-w-[85%] text-center">
                        <p className="text-danger">{error}</p>
                        {pendingJob && (
                          <div className="mt-4">
                            <button
                              className="btn-primary"
                              disabled={checking}
                              onClick={() => void checkPendingJob()}
                            >
                              {checking ? "Checking…" : "Collect the render"}
                            </button>
                            <p className="mt-2 text-xs leading-relaxed text-muted">
                              Free — the render is already paid for and this
                              just reads the result.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full max-w-xs px-4">
                        <div className="flex items-center justify-center gap-2.5">
                          <span
                            className={`inline-block h-5 w-5 animate-spin rounded-full border-2 ${
                              renderStage === "overdue"
                                ? "border-warning/30 border-t-warning"
                                : "border-muted/40 border-t-accent"
                            }`}
                          />
                          <p className="font-semibold">
                            {phase === "starting"
                              ? "Starting…"
                              : renderStage === "overdue"
                                ? "Taking longer than expected"
                                : renderStage === "almost"
                                  ? "Almost ready…"
                                  : "Rendering"}
                          </p>
                        </div>

                        {/* A wait you can watch move is a wait you sit through. */}
                        <div
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(renderProgress * 100)}
                          aria-label="Render progress"
                          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-border-soft"
                        >
                          <div
                            className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
                              renderStage === "overdue" ? "bg-warning" : "bg-accent"
                            }`}
                            style={{ width: `${Math.max(2, renderProgress * 100)}%` }}
                          />
                        </div>

                        <p className="mt-2 font-mono text-[11px] text-muted">
                          {elapsedLabel(elapsedMs)} elapsed
                          {renderStage !== "overdue" && (
                            <span> · usually about {elapsedLabel(TYPICAL_RENDER_MS)}</span>
                          )}
                        </p>

                        {renderStage === "overdue" ? (
                          <p className="mt-2 text-xs leading-relaxed text-warning">
                            This has run past the point where it is normally
                            done. It is still being polled and nothing is lost
                            — the render is paid for and can be collected later
                            — but something may be up.{" "}
                            <a
                              href={STUCK_RENDER_MAILTO}
                              className="font-semibold underline"
                            >
                              Let Ajwad know
                            </a>
                            .
                          </p>
                        ) : (
                          <p className="mt-2 text-xs leading-relaxed text-muted">
                            Safe to leave this tab — the render is tracked and
                            can be collected when you come back.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {phase === "mock" && (
                  <span className="absolute left-2 top-2 rounded bg-warning px-2 py-0.5 text-xs font-bold text-white">
                    DEMO
                  </span>
                )}
              </div>
            </div>

            {/*
              The moment someone learns this was a mock is the moment they want
              a real one, and until now the only route to that was a pill in
              the header they had scrolled a long way past. Both ways forward
              belong here: unlock if you have a code, ask for one if you do not.
            */}
            {phase === "mock" && (
              <div className="border-t border-border-soft bg-warning/[0.06] p-4">
                <p className="label !text-warning">This was a demo render</p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-foreground">
                  The whole pipeline ran — prompt, references, cost estimate —
                  but the video above is a mock and nothing was charged. To run
                  this same brief against the live models, you need an access
                  code.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {/*
                    Only offered when there is a gate to open. On a deployment
                    with no passcode configured the control does not render at
                    all, and a button that silently does nothing is worse than
                    one that was never there.
                  */}
                  {gateable && (
                    <button className="btn-primary" onClick={requestLiveUnlock}>
                      Enter your code →
                    </button>
                  )}
                  <a
                    className={gateable ? "btn-secondary" : "btn-primary"}
                    href={ACCESS_REQUEST_MAILTO}
                  >
                    {gateable ? "No code? Request one from Ajwad" : "Request access from Ajwad"}
                  </a>
                </div>
              </div>
            )}
            {videoUrl && (
              <div className="p-4">
                {musicUrl && scoringSeparately && (
                  <>
                    {/* Hidden bed, transport-locked to the video above. */}
                    <audio ref={audioRef} src={musicUrl} className="hidden" />
                    <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                      <input
                        type="checkbox"
                        className="accent-[var(--accent)]"
                        checked={musicOn}
                        onChange={(e) => {
                          setMusicOn(e.target.checked);
                          if (!e.target.checked) audioRef.current?.pause();
                          else if (!videoRef.current?.paused) syncAudio("play");
                        }}
                      />
                      Play music bed with the video
                    </label>
                  </>
                )}
                <details className="mb-3 rounded-[6px] border border-border-soft bg-surface-2 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">
                    Want to change one thing? Read this before re-rendering
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    There is no cheap edit mode. These models re-render; they do
                    not revise. Feeding this take back in as a video reference
                    is <strong>more</strong> expensive, not less — the discount
                    for video inputs is 0.6, but the input clip&apos;s duration
                    is billed too, so a {duration}s take re-run against itself
                    costs about{" "}
                    {videoToVideoRatio(duration, duration).toFixed(1)}× a fresh
                    render. In rough order of cost, the real options:
                  </p>
                  <ol className="mt-2 space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                    <li className="list-decimal">
                      <strong>Grade it in an editor — $0.</strong> For a
                      background colour shift, a hue qualifier in Resolve or
                      Premiere is free, instant, and does not risk the product
                      drifting.
                    </li>
                    <li className="list-decimal">
                      <strong>Change the reference, not the video — ~$0.04.</strong>{" "}
                      Recolour the background on your product still with an
                      image model, swap it in as the reference, and re-run. On a
                      reference-to-video model the render follows the reference,
                      so this is the controllable way to change what is in the
                      frame.
                    </li>
                    <li className="list-decimal">
                      <strong>Re-render at 480p first.</strong> If the change is
                      to the action rather than the colour, iterate at a fifth
                      the cost and only go to 1080p once it is right.
                    </li>
                  </ol>
                </details>
                <div className="flex gap-3">
                  <a
                    href={videoUrl}
                    download={`${preset.id}-ad.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Download MP4
                  </a>
                  {musicUrl && (
                    <a
                      href={musicUrl}
                      download={`${preset.id}-music`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-accent hover:underline"
                    >
                      Download music
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
