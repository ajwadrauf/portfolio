"use client";

import Link from "next/link";
import { H3_MODEL_ID, h3ReferenceProblem, videoPromptFor } from "@/lib/h3Video";
import { VELUNE_ALL_REFERENCES } from "@/lib/veluneReferences";
import { VELUNE_MEDIA } from "@/components/velune/veluneStudy";
import { H3VideoSettings } from "@/components/ad/H3VideoSettings";
import styles from "./AdLab.module.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveGate } from "@/components/LiveGate";
import { SpendChip } from "@/components/SpendChip";
import { RenderWaiting } from "@/components/studio/RenderWaiting";
import { useAudioJobs } from "@/lib/useAudioJobs";
import { soundDirection, audioReferenceProblem, ICE_CREAM_MUSIC_BRIEF } from "@/lib/adAudio";
import { SoundPlanner } from "@/components/studio/SoundPlanner";
import { AdPreflight, type PreflightReviewState } from "@/components/ad/AdPreflight";
import { useStudioProject } from "@/components/studio/StudioProjectProvider";
import { AdSceneBoard } from "@/components/ad/AdSceneBoard";
import { AdFinishing } from "@/components/ad/AdFinishing";
import { parseAdDraft, readyAdReferences, referenceRole, referenceBindingProblems, adReferenceAdditionProblem, adDocumentDataUrl, type AdLabSeed, type AdSceneCard, type AdMixTrack, type VoiceTake, type AdReferenceBinding } from "@/lib/adDraft";
import { veluneAdExample } from "@/lib/veluneAdExample";
import { effectMixTracks } from "@/lib/adAudioPlacement";
import type { CompletedPreflightTake, GenerationSnapshot } from "@/lib/adPreflight";
import { buildComposition, planProblem, planSeconds, planVideoDirection, soundPlanSchema, timedCues, voiceWindow, type EffectCue, type SoundPlan } from "@/lib/soundPlan";
import { requestLiveUnlock, useHealth } from "@/lib/useHealth";
import {
  AD_NEGATIVE_PROMPT,
  AD_PRESETS,
  CUSTOM_PRESET_ID,
  AD_VIDEO_MODELS,
  AUDIO_REF_LIMITS,
  MULTI_REF_MODELS,
  supportsEndFrame,
  REFERENCE_ROLES,
  referenceCeilingsFor,
  minAdSeconds,
  audioCapability,
  referenceMediaOf,
  referenceMediaOfUrl,
  editableRecipeOf,
  getAdPreset,
  isDefaultRecipe,
  maxAdSeconds,
  snapAdSeconds,
  DISCRETE_DURATIONS,
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
import {
  ASPECTS,
  VIDEO_RESOLUTIONS,
  resolutionsFor,
  aspectRatioValue,
  aspectsFor,
  frameSize,
  type VideoResolution,
} from "@/lib/videoCost";
import {
  LAYER_NOTES,
  SFX_LIMITS,
  SFX_MODEL_ID,
  SFX_PROMPT_TIPS,
  clampSfxSeconds,
} from "@/lib/sfx";

/** "a, b and c" — the receipt is a sentence, not a bulleted list. */
function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

type ErrorAt = "page" | "compose" | "generate";
type AdError = { text: string; at: ErrorAt } | null;

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
  /** Captured when submitted; never reconstructed from the edited form. */
  generationSnapshot?: GenerationSnapshot;
  sceneCards?: AdSceneCard[];
};

type CompletedTake = CompletedPreflightTake & {
  /** Browser memory only; the source files are not written to local storage. */
  referenceImages?: { name: string; role: string; dataUrl: string }[];
  sceneCards?: AdSceneCard[];
};

const TAKE_KEY = "adlab-completed-takes-v1";

/** Metadata only: reference files and signed reference links are not retained. */
function previousTakes(): CompletedTake[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(TAKE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((take): take is CompletedTake =>
      typeof take?.videoUrl === "string" && typeof take?.id === "string",
    ).slice(0, 12) : [];
  } catch { return []; }
}

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

/** Existing long-wait threshold; elapsed time is not completion progress. */
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
  "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/wav";

const toLines = (xs: string[]) => xs.join("\n");
const fromLines = (v: string) =>
  v.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * How much of the request body inline references may occupy, in WIRE bytes.
 *
 * The unit is the bug this constant used to have. A data URL is base64, so it
 * travels as four characters for every three bytes it decodes to — budgeting
 * 3.4MiB of decoded image put 4.53MiB of text on the wire, over Vercel's
 * 4.5MB body cap before the prompt was even added. Everything here counts what
 * is actually sent.
 *
 * The remainder is for the prompt, the recipe, the settings and JSON overhead.
 */
const MAX_INLINE_WIRE_BYTES = 4_000_000;

/** Characters of base64 in a data URL — what the request body actually carries. */
const wireBytes = (dataUrl: string) => dataUrl.length - (dataUrl.indexOf(",") + 1);

/** Tried largest first, until one fits whatever budget is left. */
const REF_TIERS: { maxSide: number; quality: number }[] = [
  { maxSide: 2048, quality: 0.92 },
  { maxSide: 2048, quality: 0.8 },
  { maxSide: 1536, quality: 0.86 },
  { maxSide: 1536, quality: 0.72 },
  { maxSide: 1024, quality: 0.86 },
  { maxSide: 1024, quality: 0.68 },
  { maxSide: 768, quality: 0.7 },
];

/** Decoded size, for anything that reasons about the image rather than the request. */
const dataUrlBytes = (u: string) => Math.ceil((u.length - (u.indexOf(",") + 1)) * 0.75);

/**
 * Downscale a reference as little as the remaining body budget allows.
 *
 * This was a flat 1024px long edge, which on a portrait pack photo meant
 * 572x1024 — and this is the endpoint whose entire purpose is holding product
 * identity while the camera moves. Label type that the model cannot read is
 * label type it cannot preserve, so the reference arrives already missing the
 * thing it was uploaded to protect.
 *
 * The budget is shared across every inline reference, so it takes the bytes
 * already committed: the first pack photo gets 2048px, and a set of ten
 * degrades gracefully instead of the eleventh failing the request.
 */
async function toProcessedDataUrl(file: File, usedWireBytes = 0): Promise<string> {
  const url = URL.createObjectURL(file);
  /*
   * No floor. The old one granted another 180KiB whenever the budget ran out,
   * which meant a full set could always add one more file and the request
   * failed anyway — with a 413 rather than an explanation. A reference that
   * does not fit is refused below, and the message names the way round it.
   */
  const budget = MAX_INLINE_WIRE_BYTES - usedWireBytes;
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
      if (wireBytes(last) <= budget) return last;
    }
    /*
     * Even the smallest tier does not fit. Returning it anyway is how a body
     * limit becomes a 413 at submit time, after the estimate has been read and
     * the spend confirmed — so refuse here, where the fix is one click.
     */
    throw new Error(
      `This reference does not fit alongside the ones already added — inline references share a ${Math.round(
        MAX_INLINE_WIRE_BYTES / 1024 / 1024,
      )}MB request body. Remove one, or add this by URL instead: a hosted reference is passed as a link and costs the body nothing.`,
    );
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

/** Clear chapter boundaries without hiding controls or unmounting audio work. */
function Step({
  n,
  title,
  aside,
  children,
  id,
  completed = false,
}: {
  n: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  /** Anchor target, so something further up the page can jump to this step. */
  id?: string;
  completed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const reveal = () => { if (window.location.hash === `#${id}`) setCollapsed(false); }; window.addEventListener("hashchange", reveal); return () => window.removeEventListener("hashchange", reveal); }, [id]);
  const chapter: Record<string, string> = {
    "ad-concept": "Find the idea", "ad-product": "Ground the picture", "ad-recipe": "Shape the story",
    "ad-prompt": "Set the direction", "ad-refs": "Guide the look & motion", "ad-format": "Choose the output",
    "ad-sound": "Build the soundtrack", "ad-generate": "From direction to film",
  };
  return (
    <section id={id} className={styles.step} aria-labelledby={`${id}-title`}>
      <div className={styles.stepHeader}>
        <span className={styles.stepNumber} aria-hidden>{String(n).padStart(2, "0")}</span>
        <div className={styles.stepHeading}>
          <p className={styles.eyebrow}>{chapter[id ?? ""]}</p>
          <h2 id={`${id}-title`} className={styles.stepTitle}>{title}</h2>
        </div>
        {aside && <div className={styles.stepAside}>{aside}</div>}
        {id !== "ad-generate" && <button type="button" className={styles.collapseStep} aria-expanded={!collapsed} aria-controls={`${id}-body`} onClick={() => setCollapsed((value) => !value)}>{collapsed ? "Expand" : completed ? "Done for now · collapse" : "Collapse"}</button>}
      </div>
      <div id={`${id}-body`} className={styles.stepBody} hidden={collapsed}>{children}</div>
    </section>
  );
}

export function AdLab(props: { availableClipIds?: string[]; clipSources?: Record<string, string> }) {
  const { project, ready } = useStudioProject();
  return <AdLabWorkspace key={project?.id ?? "loading"} {...props} workspaceReady={ready && !!project} />;
}

function AdLabWorkspace({
  availableClipIds = [],
  /** Resolved source per clip id — a hosted URL or a repo path. */
  clipSources = {},
  workspaceReady,
}: {
  availableClipIds?: string[];
  clipSources?: Record<string, string>;
  workspaceReady: boolean;
}) {
  /**
   * Shared with the gate control, so unlocking live mode updates this page
   * immediately instead of leaving it convinced it is still in demo mode.
   */
  const { health } = useHealth();
  const { project, saveDraft, saveAsset } = useStudioProject();
  const [hydrated, setHydrated] = useState(false);
  const hydrationStarted = useRef(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftSaveBlocked, setDraftSaveBlocked] = useState(false);
  const [voiceTakes, setVoiceTakes] = useState<Record<string, VoiceTake>>({});
  const [sceneCards, setSceneCards] = useState<AdSceneCard[]>([]);
  const [mixTracks, setMixTracks] = useState<AdMixTrack[]>([]);
  const [ducking, setDucking] = useState(0.7);
  const [unattachedSlots, setUnattachedSlots] = useState<string[]>([]);
  const [referenceManifest, setReferenceManifest] = useState<AdReferenceBinding[]>([]);
  const [routeNote, setRouteNote] = useState("");
  const handledRouting = useRef(0);
  const [legacyPlan, setLegacyPlan] = useState<SoundPlan | null>(null);
  const generateLock = useRef(false);
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
  const [completedTake, setCompletedTake] = useState<CompletedTake | null>(null);
  const [resultNotice, setResultNotice] = useState(false);
  const [reviewProgress, setReviewProgress] = useState<{ takeId: string; state: PreflightReviewState } | null>(null);
  const updateReviewProgress = useCallback((takeId: string, state: PreflightReviewState) => setReviewProgress({ takeId, state }), []);
  const takeReviewState = reviewProgress?.takeId === completedTake?.id ? reviewProgress?.state : "unreviewed";
  function showResultSection(id: string) {
    setResultNotice(false);
    const section = document.getElementById(id);
    section?.focus({ preventScroll: true });
    section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  }
  const [videoMetadata, setVideoMetadata] = useState<{ durationSeconds: number; width: number; height: number } | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  /*
   * An error knows where it came from.
   *
   * There was one banner near the top of the page for every failure on it,
   * which on a workflow ~11,000px tall meant a compose or a generation could
   * fail entirely off screen. The tag lets the same message render beside the
   * button that caused it; anything without a more specific home still falls
   * back to the banner.
   */
  const [error, setError] = useState<AdError>(null);
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
  /** Measured durations of supplied clips, by URL. */
  const [clipSeconds, setClipSeconds] = useState<Record<string, number>>({});
  /** The frame to land on, where the endpoint interpolates between two stills. */
  const [endImage, setEndImage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  /** What the importer changed on the way in — shown rather than applied quietly. */
  const [importNotes, setImportNotes] = useState<string[]>([]);
  /*
   * A receipt for the handover, listed at the top where you land.
   *
   * The import worked; what was missing was any acknowledgement of it above
   * the fold. You arrived at the top of an 11,000px page with a prompt sitting
   * several screens down and nothing saying so — and, more importantly,
   * nothing saying that files did not come with it.
   */
  const [importSummary, setImportSummary] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [sessionSpend, setSessionSpend] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // Reference-to-video: extra references, each with a job.
  const [refs, setRefs] = useState<
    { id?: string; url: string; media: ReferenceMedia; role: ReferenceRole; name: string }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (refs.some((ref) => !ref.id)) setRefs((current) => current.map((ref) => ref.id ? ref : { ...ref, id: crypto.randomUUID() })); }, [refs]);
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
  const [projectReferenceId, setProjectReferenceId] = useState("");
  const [projectReferenceRole, setProjectReferenceRole] = useState<ReferenceRole>("product");
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
  const endFrameInput = useRef<HTMLInputElement>(null);

  /**
   * Everything currently inline in the request body.
   *
   * The product photo and the references are separate controls but one
   * payload, and budgeting them separately let each take the whole allowance —
   * a 3.2MB photo plus 3.7MB of references is 6.9MB through a 4.5MB cap. This
   * is the number both encoders measure against.
   */
  const inlineWireBytes =
    (productImage?.startsWith("data:") ? wireBytes(productImage) : 0) +
    refs
      .filter((r) => r.url.startsWith("data:"))
      .reduce((n, r) => n + wireBytes(r.url), 0);

  /**
   * Audio settings and recipe edits are baked into the composed prompt, so
   * changing them makes the shown prompt stale — clear it rather than let
   * Generate run a prompt that no longer matches the settings.
   */
  const invalidatePrompt = useCallback(() => {
    /*
     * An imported prompt is not derived from these settings, so it is not
     * made stale by them.
     *
     * The rule below is right for a composed prompt: it is a function of the
     * recipe, so changing the recipe makes the shown text a lie. It was wrong
     * for an imported one, and wrongest in the exact workflow the importer
     * exists for — load a prompt written elsewhere, add the references it
     * addresses as [Image1] and [Video1], and adding the first reference wiped
     * the prompt. The feature destroyed its own input.
     */
    if (imported) return;
    setFinalPrompt("");
    setNegativePrompt("");
    setPhase("idle");
  }, [imported]);

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
  const [audioMode, setAudioMode] = useState<AudioMode>("native");
  const [musicStyleId, setMusicStyleId] = useState<string>(AD_PRESETS[0].musicStyleId);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicCustomPrompt, setMusicCustomPrompt] = useState("");
  const [musicSpec, setMusicSpec] = useState("");
  const [musicMock, setMusicMock] = useState(false);
  const [sfxMocks, setSfxMocks] = useState<Record<string, boolean>>({});
  const [audioError, setAudioError] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.35);
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const [musicOn, setMusicOn] = useState(true);
  /** Feed the composed bed back into the render as a timing signal. */
  const [musicAsTimingRef, setMusicAsTimingRef] = useState(false);
  const [soundPlan, setSoundPlan] = useState<SoundPlan | null>(null);
  const [scoreToPlan, setScoreToPlan] = useState(false);
  /**
   * Spot effects, keyed by the recipe's sound-design line they came from.
   * The recipe already names the effects this concept needs; generating them
   * is just taking that list seriously.
   */
  const [sfxTracks, setSfxTracks] = useState<Record<string, string>>({});
  const [sfxBusy, setSfxBusy] = useState<string | null>(null);
  const [sfxSeconds, setSfxSeconds] = useState<number>(SFX_LIMITS.defaultSeconds);
  const [customEffect, setCustomEffect] = useState("");
  const [extraEffects, setExtraEffects] = useState<string[]>([]);
  const [effectCues, setEffectCues] = useState<EffectCue[]>([]);
  const effectLines = [...new Set([...recipe.sfx, ...effectCues.map((cue) => cue.prompt), ...extraEffects])];
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const preset = getAdPreset(presetId);
  const cap = audioCapability(modelId);
  const modelName = MODELS[modelId].label.split(" (")[0];
  const supportsRefs = MULTI_REF_MODELS.includes(modelId);
  /** This endpoint interpolates between a first and a last frame. */
  const endFrameActive = supportsEndFrame(modelId);
  const secondsCap = maxAdSeconds(modelId);
  const h3 = modelId === H3_MODEL_ID;
  const refLabel = (token: string) => videoPromptFor(modelId, token);
  const referenceCaps = referenceCeilingsFor(modelId);
  /*
   * Snapped to what the endpoint publishes. Kling takes duration as an enum of
   * 5 or 10, so a slider that offers every second between 4 and 10 was mostly
   * offering values that 422 after the spend was confirmed. The control below
   * becomes a two-way choice for those models rather than lying about a range.
   */
  const allowedDurations = DISCRETE_DURATIONS[modelId];
  const duration = snapAdSeconds(
    modelId,
    Math.max(minAdSeconds(modelId), Math.min(seconds ?? preset.durationSeconds, secondsCap)),
  );
  const tokenBilled = usesTokenPricing(modelId);
  const allowedAspects = aspectsFor(modelId);
  /** Falling back keeps a Seedance-only shape from being sent to Veo. */
  const aspect =
    allowedAspects.find((a) => a.id === (aspectOverride ?? preset.aspect))?.id ??
    preset.aspect;
  const aspectChanged = !imported && aspect !== preset.aspect;
  const frame = frameSize(resolution, aspect);
  const outputSizeLabel = h3 ? resolution : `${frame.width}×${frame.height}`;
  /*
   * Supplied clips are billed by their real duration, so the estimate has to
   * know it. This used to assume a nominal length per clip, which made the
   * estimate wrong by however far the actual file differed — a 12s clay pass
   * counted as 5s, and the shortfall went straight onto the bill without ever
   * appearing on screen. Durations are measured from the file itself and
   * cached by URL; the nominal figure survives only as the fallback for a clip
   * whose metadata has not arrived yet.
   */
  /*
   * Reads each clip's duration off its own metadata. `preload="metadata"`
   * means only the header is fetched, so this costs a few KB per clip rather
   * than a download — and a clip whose metadata cannot be read (a CORS-blocked
   * host, an unusual container) simply keeps the fallback rather than
   * blocking anything.
   */
  useEffect(() => {
    const missing = refs.filter((r) => r.media === "video" && clipSeconds[r.url] === undefined);
    if (missing.length === 0) return;
    let live = true;
    for (const r of missing) {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.muted = true;
      el.onloadedmetadata = () => {
        if (live && Number.isFinite(el.duration) && el.duration > 0) {
          setClipSeconds((prev) => ({ ...prev, [r.url]: el.duration }));
        }
        el.src = "";
      };
      el.onerror = () => {
        el.src = "";
      };
      el.src = r.url;
    }
    return () => {
      live = false;
    };
  }, [refs, clipSeconds]);

  const [imageSizes, setImageSizes] = useState<Record<string, { width: number; height: number }>>({});
  const imageUrls = useMemo(() => [...(productImage ? [productImage] : []), ...refs.filter((r) => r.media === "image").map((r) => r.url)], [productImage, refs]);
  useEffect(() => {
    if (!h3) return;
    const elements = imageUrls.filter((url) => !imageSizes[url] && !VELUNE_ALL_REFERENCES.some((r) => r.url === url)).map((url) => {
      const image = new Image();
      image.onload = () => { if (image.naturalWidth && image.naturalHeight) setImageSizes((previous) => ({ ...previous, [url]: { width: image.naturalWidth, height: image.naturalHeight } })); };
      image.src = url;
      return image;
    });
    return () => elements.forEach((image) => { image.onload = null; image.src = ""; });
  }, [h3, imageUrls, imageSizes]);
  const referenceImageSizes = imageUrls.map((url) => { const size = VELUNE_ALL_REFERENCES.find((r) => r.url === url) ?? imageSizes[url]; return size ? { width: size.width, height: size.height } : undefined; });
  const referenceImagePixels = referenceImageSizes.reduce((total, size) => total + (size ? size.width * size.height : 2048 * 2048), 0);
  const referenceVideoDurations = refs.filter((r) => r.media === "video").map((r) => r.url === VELUNE_MEDIA.animatic ? 15 : clipSeconds[r.url]);
  const inputVideoSeconds = refs
    .filter((r) => r.media === "video")
    .reduce(
      (total, r) => total + (r.url === VELUNE_MEDIA.animatic ? 15 : clipSeconds[r.url] ?? VIDEO_REF_LIMITS.idealSeconds),
      0,
    );
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
  const soundPlanIssue = planProblem(soundPlan, duration, cap.native, audioMode === "silent");
  const musicBrief = musicCustomPrompt.trim() || MUSIC_STYLES.find((style) => style.id === musicStyleId)?.prompt || "";
  const musicComposition = scoreToPlan && soundPlan ? buildComposition(soundPlan, musicBrief) : undefined;
  const musicSeconds = musicComposition ? duration : musicLengthFor(duration, musicAsTimingRef);
  const musicCost = estimateCost(MUSIC_MODEL_ID, { seconds: musicSeconds });
  /** True when a separate music model will actually be billed. */
  const scoringSeparately = audioMode === "layered" && musicStyleId !== NO_MUSIC_ID;
  const musicKey = JSON.stringify([musicStyleId, musicCustomPrompt.trim(), duration, musicAsTimingRef, musicComposition]);
  const musicReady = Boolean(musicUrl && musicSpec === musicKey);
  /** Clips and tracks leave the browser, so demo mode can't accept them. */
  const clipsUploadable = health?.live ?? true;
  /** The bed can only steer the render on a model that reads audio in. */
  const timingRefAvailable = cap.refAudio && scoringSeparately;
  const timingRefActive = Boolean(timingRefAvailable && musicAsTimingRef && musicReady);

  /** Audio references sent to the model, in the order the prompt numbers them. */
  const audioRefUrls = useMemo(
    () => [
      ...refs.filter((r) => r.media === "audio").map((r) => r.url),
      ...(timingRefActive && musicUrl ? [musicUrl] : []),
    ],
    [refs, timingRefActive, musicUrl],
  );
  useEffect(() => {
    const elements = audioRefUrls.filter((url) => audioDurations[url] === undefined).map((url) => {
      const el = document.createElement("audio");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        if (Number.isFinite(el.duration)) setAudioDurations((previous) => ({ ...previous, [url]: el.duration }));
      };
      el.src = url;
      return el;
    });
    return () => elements.forEach((el) => { el.onloadedmetadata = null; el.removeAttribute("src"); el.load(); });
  }, [audioRefUrls, audioDurations]);
  const inputAudioSeconds = audioRefUrls.reduce((sum, url) => sum + (audioDurations[url] ?? 0), 0);
  const videoCost = estimateCost(modelId, { seconds: duration, resolution, aspect, hasVideoInputs: inputVideoSeconds > 0, inputVideoSeconds, referenceImagePixels, inputAudioSeconds });
  const cost = videoCost + (scoringSeparately && !musicReady ? musicCost : 0);
  const h3InputProblem = h3 ? h3ReferenceProblem(imageUrls.length, referenceVideoDurations, audioRefUrls.map((url) => audioDurations[url]))
    ?? (referenceImageSizes.some((size) => !size) ? "H3 Max image dimensions are not verified yet. Wait for the image to load, or reattach a readable file." : null)
    ?? (!Number.isInteger(seconds ?? preset.durationSeconds) || (seconds ?? preset.durationSeconds) < 5 || (seconds ?? preset.durationSeconds) > 15 ? "H3 Max needs a 5–15 second edit. Set a supported length; longer plans must be split into shots." : null) : null;
  const audioRefProblem = cap.refAudio ? audioReferenceProblem(audioRefUrls.map((url) => audioDurations[url]), (productImage ? 1 : 0) + refs.filter((r) => r.media !== "audio").length, modelId) : null;
  const soundBlock = soundDirection(audioMode, musicBrief, timingRefActive ? audioRefUrls.length : undefined, imported || refs.some((r) => r.media === "video"), modelId) + planVideoDirection(soundPlan);
  /** Reference jobs, ordered to match the URLs above per media type. */
  const composeRefs = useMemo<ReferenceSpec[]>(
    () => [
      ...(productImage ? [{ role: "product", media: "image" } as ReferenceSpec] : []),
      ...refs.map((r) => ({ role: r.role, media: r.media }) as ReferenceSpec),
      ...(timingRefActive ? [{ role: "rhythm", media: "audio" } as ReferenceSpec] : []),
    ],
    [productImage, refs, timingRefActive],
  );

  // A project change remounts this workspace. A completed old job keeps its original save callback.
  useEffect(() => {
    if (!workspaceReady || !project || hydrationStarted.current) return;
    hydrationStarted.current = true;
    let draft = parseAdDraft(project.drafts.ad);
    if (project.drafts.ad && !draft) {
      setDraftSaveBlocked(true);
      setDraftStatus("This saved Ad draft uses unsupported fields. It is preserved; export the project before replacing the draft.");
    }
    if (!draft && !project.drafts.ad && project.example === "velune") {
      draft = veluneAdExample(project.assets);
    }
    if (draft) {
      setPresetId(AD_PRESETS.some((p) => p.id === draft.presetId) ? draft.presetId! : AD_PRESETS[0].id);
      setParams(draft.params ?? {}); setProductImage(draft.productImage ?? null); setEndImage(draft.endImage ?? null);
      setModelId(draft.modelId); setFinalPrompt(draft.prompt); setNegativePrompt(draft.negativePrompt ?? AD_NEGATIVE_PROMPT);
      setSeconds(draft.duration); setAspectOverride(draft.aspect ?? null); setResolution(draft.resolution ?? "480p");
      setLane(draft.lane ?? (draft.source === "blender" || draft.source === "velune" || draft.source === "prompt" || draft.source === "campaign" ? "blender" : "recipe"));
      setImported(draft.imported ?? draft.source !== "ad"); setPhase(draft.completedTake ? "done" : draft.prompt ? "ready" : "idle");
      setRefs(draft.references.map((r) => ({ id: r.id, name: r.name, media: r.kind, role: referenceRole(r.kind, r.role), url: r.dataUrl ?? r.url! })));
      if (draft.recipe) setRecipe(draft.recipe);
      setAudioMode(draft.audioMode ?? "native"); setSoundPlan(draft.soundPlan ?? null); setScoreToPlan(draft.scoreToPlan ?? false); setVoiceTakes(draft.voiceTakes ?? {});
      setMusicStyleId(draft.musicStyleId ?? AD_PRESETS[0].musicStyleId); setMusicUrl(draft.musicUrl ?? null); setMusicSpec(draft.musicSpec ?? ""); setMusicMock(draft.musicMock ?? false); setMusicCustomPrompt(draft.musicCustomPrompt ?? ""); setMusicAsTimingRef(draft.musicAsTimingRef ?? false); setMusicVolume(draft.musicVolume ?? 0.35); setMusicOn(draft.musicOn ?? true);
      setEffectCues(draft.effectCues ?? []); setSfxTracks(draft.sfxTracks ?? {}); setSfxMocks(draft.sfxMocks ?? {}); setExtraEffects(draft.extraEffects ?? []); setSfxSeconds(draft.sfxSeconds ?? SFX_LIMITS.defaultSeconds); setCustomEffect(draft.customEffect ?? "");
      setSceneCards(draft.sceneCards ?? []); setMixTracks(draft.mixTracks ?? []); setDucking(draft.ducking ?? 0.7); setUnattachedSlots(draft.unattachedSlots ?? []);
      setReferenceManifest(draft.referenceManifest ?? draft.references.filter((r) => r.token).map((r) => ({ token: r.token!, job: r.role, assetId: r.id })));
      setCompletedTake(draft.completedTake ?? null); setVideoUrl(draft.completedTake?.videoUrl ?? null);
      if (draft.source !== "ad") setImportSummary([`${draft.source === "velune" ? "VELUNE's actual 15-second camera study and concept brief" : `the ${draft.source} prompt`}`, `${draft.references.length} attached reference files`, `its ${draft.duration}-second length`]);
    } else if (!project.drafts.ad) {
      // Backward compatibility for old links. This one-time text transfer still carries no files.
      try {
        const handed = sessionStorage.getItem("adlab-imported-prompt");
        if (handed) {
          const result = importPrompt(handed); setFinalPrompt(result.prompt); setNegativePrompt(AD_NEGATIVE_PROMPT); setImported(true); setPhase("ready"); setLane("blender"); setModelId("seedance-2.5-ref"); setImportNotes(result.notes); setImportSummary(["legacy prompt text; no reference files"]);
          if (result.aspect && ASPECTS.some((a) => a.id === result.aspect)) setAspectOverride(result.aspect);
          const seconds = Number(sessionStorage.getItem("adlab-imported-duration")); if (Number.isFinite(seconds) && seconds >= 4 && seconds <= 30) setSeconds(seconds);
          ["adlab-imported-prompt", "adlab-imported-duration", "adlab-lane"].forEach((key) => sessionStorage.removeItem(key));
        }
      } catch { /* Shared project state remains usable without sessionStorage. */ }
      try { const saved = JSON.parse(localStorage.getItem("adlab-sound-plan-v1") ?? "null"); const parsed = soundPlanSchema.safeParse(saved?.plan); if (parsed.success) setLegacyPlan(parsed.data); } catch { /* Legacy plan remains untouched. */ }
    }
    setHydrated(true);
  }, [workspaceReady, project]);

  const draft = useMemo<AdLabSeed>(() => ({ schema: "adlab-draft-v1", source: "ad", prompt: finalPrompt, modelId, duration, aspect, references: refs.map((r, i) => ({ id: r.id ?? `ad-ref-${i}`, name: r.name, kind: r.media, role: r.role, ...(r.url.startsWith("data:") ? { dataUrl: r.url } : { url: r.url }) })), presetId, params, productImage, endImage, negativePrompt, lane, imported, resolution, recipe, audioMode, soundPlan, scoreToPlan, voiceTakes, musicStyleId, musicUrl, musicSpec, musicMock, musicCustomPrompt, musicAsTimingRef, musicVolume, musicOn, sfxTracks, sfxMocks, extraEffects, sfxSeconds, customEffect, effectCues, sceneCards, mixTracks, ducking, completedTake, unattachedSlots, referenceManifest }), [finalPrompt, modelId, duration, aspect, refs, presetId, params, productImage, endImage, negativePrompt, lane, imported, resolution, recipe, audioMode, soundPlan, scoreToPlan, voiceTakes, musicStyleId, musicUrl, musicSpec, musicMock, musicCustomPrompt, musicAsTimingRef, musicVolume, musicOn, sfxTracks, sfxMocks, extraEffects, sfxSeconds, customEffect, effectCues, sceneCards, mixTracks, ducking, completedTake, unattachedSlots, referenceManifest]);
  const latestDraft = useRef({ draft, saveable: hydrated && !draftSaveBlocked });
  latestDraft.current = { draft, saveable: hydrated && !draftSaveBlocked };
  useEffect(() => {
    if (!hydrated || draftSaveBlocked) return;
    let current = true; setDraftStatus("Saving draft…");
    const timer = setTimeout(() => { void saveDraft("ad", draft).then(() => { if (current) setDraftStatus("Draft saved in this project"); }).catch((e) => { if (current) setDraftStatus(e instanceof Error ? e.message : "Draft could not be saved. Keep this tab open."); }); }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [draft, hydrated, draftSaveBlocked, saveDraft]);
  useEffect(() => () => { if (latestDraft.current.saveable) void saveDraft("ad", latestDraft.current.draft).catch(() => { /* Provider surfaces persistence errors. */ }); }, [saveDraft]);

  useEffect(() => {
    if (!hydrated || !project) return;
    const route = project.drafts.routing as { kind?: string; modelId?: string; selectedAt?: number; handledAt?: number; scenario?: { seconds?: number; aspect?: string; resolution?: VideoResolution } } | undefined;
    if (!route || typeof route.selectedAt !== "number" || route.handledAt === route.selectedAt || handledRouting.current === route.selectedAt) return;
    handledRouting.current = route.selectedAt;
    if (route.kind === "video" && route.modelId && AD_VIDEO_MODELS.includes(route.modelId)) {
      setModelId(route.modelId);
      if (typeof route.scenario?.seconds === "number" && Number.isFinite(route.scenario.seconds)) setSeconds(snapAdSeconds(route.modelId, Math.min(maxAdSeconds(route.modelId), Math.max(4, route.scenario.seconds))));
      if (aspectsFor(route.modelId).some((a) => a.id === route.scenario?.aspect)) setAspectOverride(route.scenario!.aspect!);
      if (resolutionsFor(route.modelId).includes(route.scenario?.resolution as VideoResolution)) setResolution(route.scenario!.resolution!);
      setRouteNote(`Model Explorer selected ${MODELS[route.modelId].label}. Review the new output settings against your existing prompt and references.`);
    } else if (["music", "voice", "sfx"].includes(route.kind ?? "")) {
      setRouteNote(`Model Explorer selected ${route.kind}. Use the corresponding ElevenLabs control in Sound; no audio request has started.`);
      window.location.hash = "ad-sound";
    }
    void saveDraft("routing", { ...route, handledAt: route.selectedAt }).catch((e) => setDraftStatus(e instanceof Error ? e.message : "Could not record the model selection."));
  }, [hydrated, project, saveDraft]);

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

  const showCompletedTake = useCallback((url: string, requestId: string, generationSnapshot?: GenerationSnapshot | null, referenceImages?: CompletedTake["referenceImages"], sceneCards?: AdSceneCard[]) => {
    const history = previousTakes();
    const saved = history.find((take) => take.videoUrl === url && take.id === requestId);
    const take: CompletedTake = {
      videoUrl: url,
      id: requestId,
      context: generationSnapshot ?? saved?.context ?? null,
      referenceImages,
      sceneCards: sceneCards ?? saved?.sceneCards,
    };
    setCompletedTake(take);
    setResultNotice(true);
    setVideoUrl(url);
    const displayed = videoRef.current;
    setVideoMetadata(displayed?.currentSrc === url && Number.isFinite(displayed.duration)
      ? { durationSeconds: displayed.duration, width: displayed.videoWidth, height: displayed.videoHeight }
      : null);
    setPhase("done");
    void saveAsset({ id: `ad-video-${requestId}`.slice(0, 200), name: `Ad Lab · ${generationSnapshot?.durationSeconds ?? saved?.context?.durationSeconds ?? "completed"}s take`, kind: "video", url, role: "Completed model output · native audio; review required", source: "generated", status: "ready", metadata: { takeId: take.id, context: take.context, sceneCards: take.sceneCards ?? null } }).catch((e) => setDraftStatus(`Video is ready, but project save failed: ${e instanceof Error ? e.message : "storage unavailable"}`));
    try {
      const retained = { id: take.id, videoUrl: take.videoUrl, context: take.context, sceneCards: take.sceneCards };
      localStorage.setItem(TAKE_KEY, JSON.stringify([retained, ...history.filter((item) => item.videoUrl !== url)].slice(0, 12)));
    } catch { /* The take stays usable if browser storage is full or disabled. */ }
  }, [saveAsset]);

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
        showCompletedTake(status.videoUrl, pendingJob.falRequestId ?? pendingJob.operationName ?? status.videoUrl, pendingJob.generationSnapshot, undefined, pendingJob.sceneCards);
        rememberJob(null);
        return;
      }
      if (status.status === "failed") {
        fail(status.error ?? "The provider reported this render as failed.");
        rememberJob(null);
        return;
      }
      fail("Still rendering on the provider side. Check again in a minute.");
    } catch {
      fail("Could not reach the provider. Check again in a moment.");
    } finally {
      setChecking(false);
    }
  }, [pendingJob, rememberJob, showCompletedTake]);

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
          showCompletedTake(status.videoUrl, id);
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
    [modelId, rememberJob, showCompletedTake],
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

  const audioJobs = useAudioJobs(addSpend);
  const keepAudio = useCallback((url: string, name: string, role: string) => {
    void saveAsset({ id: `ad-audio-${crypto.randomUUID()}`, name: name.slice(0, 240), kind: "audio", url, role, source: "generated", status: "ready" }).catch((e) => setDraftStatus(`Audio is ready, but project save failed: ${e instanceof Error ? e.message : "storage unavailable"}`));
  }, [saveAsset]);

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
        fail(e instanceof Error ? e.message : "Photo analysis failed");
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
      setSceneCards([]); setReferenceManifest([]); setUnattachedSlots([]); setVoiceTakes({}); setMixTracks([]); setImported(false); setCompletedTake(null); setVideoMetadata(null);
      setRecipe(editableRecipeOf(next));
      // A blank recipe in read mode is a set of empty headings, which reads as
      // broken rather than as an invitation. The custom concept opens straight
      // into the editor; a worked preset is worth reading first.
      setEditingRecipe(id === CUSTOM_PRESET_ID);
      setMusicStyleId(next.musicStyleId);
      setMusicCustomPrompt("");
      setSoundPlan(null);
      setScoreToPlan(false);
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
    setSceneCards([]); setReferenceManifest([]);
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

  /** Record a failure, and where on the page it belongs. */
  const fail = useCallback((text: string, at: ErrorAt = "page") => {
    setError({ text, at });
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
      fail(e instanceof Error ? e.message : "Compose failed", "compose");
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
      if ((productImage ? 1 : 0) + refs.length + (timingRefActive ? 1 : 0) >= referenceCaps.total || refs.filter((r) => r.media === media).length + (media === "image" && productImage ? 1 : 0) >= referenceCaps[media]) { setRefError(`This model accepts at most ${referenceCaps.total} combined references. Remove a file before adding another.`); return; }
      try {
        if ((isAudio || /\.(m4a|aac)$/i.test(file.name)) && !/\.(mp3|wav)$/i.test(file.name)) {
          setRefError("Audio references must be MP3 or WAV in Ad Lab. Convert this track before uploading.");
          return;
        }
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
          const dataUrl = await toProcessedDataUrl(file, inlineWireBytes);
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
    // `refs` is read to measure the budget already spent, so it belongs here —
    // without it the first upload's size would be used for every later one.
    // Reads inlineWireBytes to budget against everything already in the body.
    [health, invalidatePrompt, inlineWireBytes, refs, productImage, referenceCaps, timingRefActive],
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
    if ((productImage ? 1 : 0) + refs.length + (timingRefActive ? 1 : 0) >= referenceCaps.total) { setRefError(`This model accepts at most ${referenceCaps.total} combined references. Remove a file first.`); return; }
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
  }, [invalidatePrompt, refUrl, productImage, refs, referenceCaps, timingRefActive]);

  const sfxCost = estimateCost(SFX_MODEL_ID, { seconds: clampSfxSeconds(sfxSeconds) });

  /** One effect per call — two events in one prompt gives a muddle of both. */
  const generateSfx = useCallback(
    async (text: string) => {
      setAudioError(null);
      setSfxBusy(text);
      try {
        const json = await audioJobs.run("/api/ad/sfx", { text, durationSeconds: effectCues.find((cue) => cue.prompt === text)?.seconds ?? sfxSeconds }, text);
        setSfxTracks((prev) => ({ ...prev, [text]: json.audioUrl }));
        setSfxMocks((prev) => ({ ...prev, [text]: json.mock }));
        if (!json.mock) keepAudio(json.audioUrl, text, "Sound effect · separate take");
      } catch (e) {
        setAudioError(e instanceof Error ? e.message : "Sound effect failed");
      } finally {
        setSfxBusy(null);
      }
    },
    [audioJobs, sfxSeconds, effectCues, keepAudio],
  );

  const generateMusic = useCallback(async () => {
    setAudioError(null);
    if (musicComposition && soundPlanIssue) { setAudioError(soundPlanIssue); return; }
    setMusicBusy(true);
    try {
      const json = await audioJobs.run("/api/ad/music", { styleId: musicStyleId, durationSeconds: duration, customPrompt: musicCustomPrompt.trim() || undefined, timingReference: musicAsTimingRef, compositionPlan: musicComposition }, `${MUSIC_STYLES.find((s) => s.id === musicStyleId)?.label ?? "Custom music"} · ${duration}s cut`);
      setMusicUrl(json.audioUrl);
      setMusicSpec(musicKey);
      setMusicMock(json.mock);
      if (!json.mock) keepAudio(json.audioUrl, `${MUSIC_STYLES.find((s) => s.id === musicStyleId)?.label ?? "Music"} · ${duration}s cut`, "Music · separate take");
      setMusicOn(true);
      // A bed used as a timing signal changes the prompt, so it goes stale.
      if (musicAsTimingRef) invalidatePrompt();
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Music generation failed");
    } finally {
      setMusicBusy(false);
    }
  }, [audioJobs, duration, invalidatePrompt, musicAsTimingRef, musicStyleId, musicCustomPrompt, musicKey, musicComposition, soundPlanIssue, keepAudio]);

  /** Keep the separately generated music bed locked to the video's transport. */
  const syncAudio = useCallback(
    (action: "play" | "pause" | "seek", enabled = musicOn) => {
      const v = videoRef.current;
      const a = audioRef.current;
      if (!v || !a) return;
      if (action === "pause") {
        a.pause();
        return;
      }
      a.currentTime = Math.min(v.currentTime, a.duration || v.currentTime);
      a.playbackRate = v.playbackRate;
      a.volume = musicVolume;
      if (enabled && (action === "play" || (action === "seek" && !v.paused))) void a.play().catch(() => setAudioError("The browser paused the music. Press play on the video again to enable the mix preview."));
    },
    [musicOn, musicVolume],
  );
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
    if (!musicReady || !scoringSeparately) audioRef.current?.pause();
    const pause = () => { if (document.hidden) { videoRef.current?.pause(); audioRef.current?.pause(); } };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [musicVolume, musicReady, scoringSeparately]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const boardReferences = useMemo<AdLabSeed["references"]>(() => [
    ...(productImage ? [{ id: "ad-product", name: "Product photo", kind: "image" as const, role: "product", dataUrl: productImage }] : []),
    ...refs.map((r, i) => ({ id: r.id ?? `ad-ref-${i}`, name: r.name, kind: r.media, role: r.role, ...(r.url.startsWith("data:") ? { dataUrl: r.url } : { url: r.url }) })),
  ], [productImage, refs]);
  const projectReferences = useMemo(() => readyAdReferences(project?.assets ?? []), [project?.assets]);
  const selectedProjectReference = projectReferences.find((reference) => reference.id === projectReferenceId);
  function addProjectReference() {
    if (!selectedProjectReference) return;
    const problem = adReferenceAdditionProblem(selectedProjectReference, boardReferences, { audio: timingRefActive ? 1 : 0 }, modelId);
    if (problem) { setRefError(problem); return; }
    const selected = selectedProjectReference;
    setRefs((previous) => previous.some((ref) => ref.id === selected.id || ref.url === (selected.dataUrl ?? selected.url)) ? previous : [...previous, { id: selected.id, name: selected.name, media: selected.kind, role: referenceRole(selected.kind, projectReferenceRole), url: selected.dataUrl ?? selected.url! }]);
    setProjectReferenceId(""); setRefError(null); setRefCheck(null); invalidatePrompt();
  }
  const boardCards = useMemo<AdSceneCard[]>(() => sceneCards.length ? sceneCards : soundPlan ? timedCues(soundPlan).map((cue, i) => ({ id: cue.id, title: cue.title, start: cue.start, end: cue.end, action: recipe.scenes[i]?.description ?? "Describe the action", camera: "", sound: [cue.line, cue.music].filter(Boolean).join(" · "), referenceIds: productImage ? ["ad-product"] : [] })) : imported ? [{ id: "imported-direction", title: "Imported direction · confirm the shot breakdown", start: 0, end: duration, action: finalPrompt.slice(0, 6000), camera: "Follow the attached motion and composition references", sound: "Review the sound direction below", referenceIds: boardReferences.filter((ref) => ref.kind === "image").map((ref) => ref.id) }] : recipe.scenes.map((scene, i) => ({ id: `recipe-${i}`, title: scene.title, start: duration * i / recipe.scenes.length, end: duration * (i + 1) / recipe.scenes.length, action: scene.description, camera: "", sound: recipe.sfx[i] ?? "", referenceIds: productImage ? ["ad-product"] : [] })), [sceneCards, soundPlan, recipe, duration, productImage, imported, finalPrompt, boardReferences]);
  const bindingProblems = [...referenceBindingProblems(boardReferences, referenceManifest), ...(h3InputProblem ? [h3InputProblem] : []), ...(["image", "video", "audio"] as const).flatMap((kind) => boardReferences.filter((ref) => ref.kind === kind).length > referenceCaps[kind] ? [`Too many ${kind} references: this endpoint supports at most ${referenceCaps[kind]}. Remove extra files before generating.`] : []), ...(!supportsRefs && Object.values(refSlots(finalPrompt)).some((count) => count > 0) ? ["This prompt uses reference tokens. Choose H3 Max Reference or Seedance Reference to resolve them, or rewrite the prompt for a first-frame model."] : [])];
  const finishingDuration = completedTake ? videoMetadata?.durationSeconds ?? completedTake.context?.durationSeconds ?? duration : duration;
  const finishingScenes = completedTake ? completedTake.sceneCards ?? [] : boardCards;
  const availableMixTracks = useMemo<AdMixTrack[]>(() => {
    const base = { trim: 0, fadeIn: 0.05, fadeOut: 0.1, enabled: true };
    const cues = soundPlan ? timedCues(soundPlan) : [];
    return [
      ...(musicUrl && !musicMock ? [{ ...base, id: "music-bed", name: "Music bed", url: musicUrl, kind: "music" as const, start: 0, length: finishingDuration, gain: musicVolume, fadeIn: 0.25, fadeOut: 0.75 }] : []),
      ...Object.entries(voiceTakes).filter(([id, take]) => !take.mock && cues.some((cue) => cue.id === id)).map(([id, take]) => { const cue = cues.find((c) => c.id === id); const window = cue ? voiceWindow(cue) : null; return { ...base, id: `voice-${id}`, name: take.label ?? cue?.title ?? "Scene voice", url: take.url, kind: "voice" as const, start: window?.start ?? 0, length: window?.seconds ?? finishingDuration, gain: 1 }; }),
      ...refs.filter((ref) => ref.media === "audio" && ref.url !== musicUrl && !Object.values(voiceTakes).some((take) => take.url === ref.url) && !Object.values(sfxTracks).includes(ref.url)).map((ref, i) => ({ ...base, id: `reference-${ref.id ?? i}`, name: `Attached audio · ${ref.name}`.slice(0, 300), url: ref.url, kind: ref.role === "voice" ? "voice" as const : ref.role === "rhythm" ? "music" as const : "effect" as const, start: 0, length: Math.min(audioDurations[ref.url] ?? finishingDuration, finishingDuration), gain: 1 })),
      ...Object.entries(sfxTracks).filter(([line]) => !sfxMocks[line]).flatMap(([line, url], i) => effectMixTracks(line, url, i, effectCues, Math.min(audioDurations[url] ?? sfxSeconds, finishingDuration))),
    ];
  }, [musicUrl, musicMock, musicVolume, finishingDuration, voiceTakes, soundPlan, sfxTracks, sfxMocks, effectCues, audioDurations, sfxSeconds, refs]);

  const generate = useCallback(async () => {
    if (generateLock.current || !hydrated || draftSaveBlocked) return;
    if (bindingProblems.length) { setError({ at: "generate", text: bindingProblems[0] }); return; }
    setError(null);
    if (audioJobs.busy || audioRefProblem || soundPlanIssue) { setAudioError(soundPlanIssue ?? audioRefProblem ?? "Wait for the audio request to finish before generating video."); return; }
    generateLock.current = true;
    if (health?.live) {
      const ok = window.confirm(
        `This will run one live ${duration}s video generation at an estimated cost of $${cost.toFixed(2)}. Proceed?`,
      );
      if (!ok) { generateLock.current = false; return; }
    }
    // Freeze the actual request, including the sound directions. Editing the
    // form while it renders must not rewrite the evidence for the finished take.
    const generationSnapshot: GenerationSnapshot = {
      submittedAt: new Date().toISOString(),
      prompt: videoPromptFor(modelId, `${finalPrompt}\n\n${soundBlock}`),
      negativePrompt,
      modelId,
      durationSeconds: duration,
      aspect,
      resolution,
      audioMode: h3 && audioMode === "silent" ? "External soundtrack; H3 native audio may remain" : audioMode,
      references: [
        ...(productImage ? [{ name: "Product photo", media: "image", role: "product" }] : []),
        ...(endFrameActive && endImage ? [{ name: "End frame", media: "image", role: "composition" }] : []),
        ...(supportsRefs ? refs.map(({ name, media, role }) => ({ name, media, role })) : []),
        ...(timingRefActive && musicUrl ? [{ name: "Generated music timing reference", media: "audio", role: "rhythm" }] : []),
      ],
    };
    const takeSceneCards = boardCards.map((card) => ({ ...card, referenceIds: [...card.referenceIds] }));
    const takeReferenceImages = [
      ...(productImage?.startsWith("data:image/") ? [{ name: "Product photo", role: "product", dataUrl: productImage }] : []),
      ...(supportsRefs ? refs.filter((r) => r.media === "image" && r.role === "product" && r.url.startsWith("data:image/")).map((r) => ({ name: r.name, role: r.role, dataUrl: r.url })) : []),
    ].slice(0, 3);
    setPhase("starting");
    setRenderStartedAt(Date.now());
    setElapsedMs(0);
    setVideoUrl(null);
    setVideoMetadata(null);
    setCompletedTake(null);
    setPosterDataUrl(null);
    try {
      const requestBody = JSON.stringify({
          prompt: videoPromptFor(modelId, `${finalPrompt}\n\n${soundBlock}`),
          negativePrompt,
          modelId,
          aspect,
          durationSeconds: duration,
          resolution,
          // Measured, not assumed — supplied footage is billed by its real
          // length and the server prices the spend from this.
          inputVideoSeconds,
          referenceVideoDurations: h3 ? referenceVideoDurations : undefined,
          referenceImageSizes: h3 ? referenceImageSizes : undefined,
          imageDataUrl: productImage ?? undefined,
          endImageDataUrl: endFrameActive ? (endImage ?? undefined) : undefined,
          referenceImageDataUrls: supportsRefs
            ? refs.filter((r) => r.media === "image").map((r) => r.url)
            : undefined,
          referenceVideoUrls: supportsRefs
            ? refs.filter((r) => r.media === "video").map((r) => r.url)
            : undefined,
          referenceAudioUrls: supportsRefs ? audioRefUrls : undefined,
          referenceAudioDurations: cap.refAudio ? audioRefUrls.map((url) => audioDurations[url]) : undefined,
          generateAudio: cap.switchable ? audioMode !== "silent" : undefined,
          presetName: preset.name,
        });
      if (new TextEncoder().encode(requestBody).byteLength > 4_194_304) throw new Error("The combined references and prompt exceed the 4 MiB request limit. Use hosted media links or smaller image references before generating.");
      const res = await fetch("/api/ad/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to start");
      if (json.mock) {
        setPosterDataUrl(json.posterDataUrl);
        setPhase("mock");
        return;
      }
      addSpend(json.cost ?? 0);
      // Start music only after the video response has updated the budget cookie.
      // Both jobs can then render concurrently without racing that cookie.
      if (scoringSeparately && !musicReady && !musicAsTimingRef) void generateMusic();
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
        generationSnapshot,
        sceneCards: takeSceneCards,
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
          showCompletedTake(status.videoUrl!, json.falRequestId ?? json.operationName ?? status.videoUrl, generationSnapshot, takeReferenceImages, takeSceneCards);
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
      fail(e instanceof Error ? e.message : "Generation failed", "generate");
      setPhase("failed");
    } finally { generateLock.current = false; }
  }, [
    hydrated, draftSaveBlocked, bindingProblems, boardCards,
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
    showCompletedTake,
    resolution,
    productImage,
    refs,
    scoringSeparately,
    supportsRefs,
    timingRefActive,
    endFrameActive, endImage,
    audioJobs.busy, audioRefProblem, soundPlanIssue, soundBlock, audioDurations, cap.refAudio, cap.switchable, musicReady, musicAsTimingRef, h3, referenceVideoDurations, referenceImageSizes,
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
        className="-my-2 inline-flex items-center py-2 text-xs font-semibold text-accent hover:underline"
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
      setResolution(h3 ? "768p" : allowedResolutions[allowedResolutions.length - 1].id);
    }
  }, [allowedResolutions, resolution, h3]);

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
      fail("Could not run the reference check.");
    } finally {
      setCheckingRefs(false);
    }
  }, [productImage, refs]);

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

  /** There is a passcode gate on this deployment, so a code can be entered. */
  const gateable = health?.gate === "locked" || health?.gate === "exhausted";

  /** Something was flagged above the spend button, whichever lane raised it. */
  const flagged = blenderLane ? slotGaps.length > 0 : unmet.length > 0;

  /*
   * The one thing left to do, read off the state the page already keeps.
   *
   * Deliberately derived rather than a step counter: the two lanes have
   * different steps — the Blender lane has no concept, product or recipe at
   * all — so a fixed "step 3 of 8" would be wrong half the time. This asks
   * the same questions the Generate button asks, in the order they block on.
   */
  /** The bed must exist before a render that uses it as a reference. */
  const blockedOnMusic = timingRefAvailable && musicAsTimingRef && !musicReady;
  const soundNext: { label: string; href: string } | null = audioJobs.busy
    ? { label: "Wait for the audio request", href: "#ad-sound" }
    : soundPlanIssue
      ? { label: "Check the sound plan", href: "#ad-sound" }
    : audioRefProblem
      ? { label: "Resolve the audio reference", href: "#ad-sound" }
      : blockedOnMusic
        ? { label: "Generate the music reference", href: "#ad-sound" }
        : null;
  const nextUp: { label: string; href: string } = blenderLane
    ? !finalPrompt.trim()
      ? { label: "Paste or import the prompt", href: "#ad-prompt" }
      : h3InputProblem ? { label: "Check H3 reference requirements", href: "#ad-refs" }
      : slotGaps.length > 0
        ? { label: "Attach the references the prompt names", href: "#ad-refs" }
        : soundNext ?? { label: "Ready to generate", href: "#ad-generate" }
    : !productImage
      ? { label: "Upload the product photo", href: "#ad-product" }
      : unmet.length > 0
        ? { label: "Add the references this recipe needs", href: "#ad-refs" }
        : !finalPrompt.trim()
          ? { label: "Compose the prompt", href: "#ad-prompt" }
          : soundNext ?? { label: "Ready to generate", href: "#ad-generate" };

  const audioChoices = [
    ...(cap.native
      ? [
          {
            id: "native" as AudioMode,
            title: h3 ? "Native sound — keep the model’s audio" : "Native sound — start here",
            body: modelId.startsWith("seedance")
              ? "One video request, one MP4 with sound. Seedance generates effects, ambience and musical direction with no extra native-audio charge. Audition this first."
              : "Sound is generated with the picture in one file. Listen to the result before deciding whether it needs a separate score or effects.",
          },
        ]
      : []),
    {
      id: "layered" as AudioMode,
      title: cap.native
        ? `Layered — add an ElevenLabs score`
        : `Layered — a composed music bed (${modelName} renders no sound)`,
      body: cap.native
        ? "Ask the video model for effects and ambience, then compose an instrumental track through fal. Extra audio charge; the track stays a separate file for your final edit."
        : "This model returns a silent MP4, so the whole soundtrack is built here: ElevenLabs Music writes the bed and you add effects in the edit.",
    },
    {
      id: "silent" as AudioMode,
      title: h3 ? "External soundtrack — finish with ElevenLabs" : "Silent — deliver picture only",
      body: h3 ? "Generate the picture first. The prompt requests no speech or music, but H3 can still return native audio. Mute or discard that track, then add your separate ElevenLabs voice, music and effects. This selection does not auto-generate music." : cap.switchable
        ? `Native audio is switched off at the API, not just asked off in the prompt. Use this for a soundtrack you will build entirely in the edit.`
        : "The prompt asks for a silent take. Use this for a soundtrack you will build entirely in the edit.",
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>AI Content Studio · Video workspace</p>
          <h1 id="ad-lab-workspace" className={styles.heroTitle}>Ad Lab</h1>
          <p className={styles.lead}>Shape the picture. Plan the sound. Make the film.</p>
        </div>
        <a href="#cream-making-of" className={styles.heroLink}>See how a film was made <span aria-hidden>↘</span></a>
      </div>

      <p role="status" className="mt-4 text-xs text-muted">{workspaceReady ? draftStatus : "Opening project storage…"}</p>
      {draftSaveBlocked && <button type="button" className="btn-secondary mt-2" onClick={() => { if (window.confirm("Replace the unsupported Ad draft with the current form? Export the project first if you need to preserve that draft.")) setDraftSaveBlocked(false); }}>Replace unsupported Ad draft</button>}
      {routeNote && <p role="status" className="mt-3 rounded-lg border border-accent/30 p-3 text-sm">{routeNote}</p>}
      {project?.example === "velune" && <div className="mt-5 rounded-xl border border-border-soft p-4"><p className="text-sm font-semibold">VELUNE · camera plan + visual references</p><p className="mt-2 text-xs leading-relaxed text-muted">Revision 2 loads eleven images: nine new references and two retained chocolate studies, plus the original Blender guide. H3 Max stays selected at 768p for 15 seconds. Solo cartons, real ingredient detail, working gestures and a new product reveal guide this take. All twelve reference slots are used; ElevenLabs sound is added in finishing. Existing drafts keep their chosen files. Exact report graphics and final-film review remain finishing work.</p><div className="mt-2 flex flex-wrap gap-4"><Link href="/velune#visual-references" className="inline-flex min-h-9 items-center text-xs font-semibold text-accent underline">See what each image directs ↗</Link><Link href="/ai-studio/projects" className="inline-flex min-h-9 items-center text-xs font-semibold text-accent underline">Add references to an older project ↗</Link></div>{unattachedSlots.length > 0 && <details className="mt-3" open><summary className="min-h-8 cursor-pointer text-xs font-semibold">Remaining reference checklist</summary><ul className="list-disc space-y-1 pl-4 text-xs text-muted">{unattachedSlots.map((slot) => <li key={slot}>{slot}</li>)}</ul></details>}<video controls preload="metadata" src={project.assets.find((a) => a.id === "velune-motion" && a.status === "ready")?.url} className="mt-3 max-h-72 w-full rounded-lg bg-black" /></div>}
      <div className={styles.utilities}>
        <div className={styles.sessionControls}>
          <LiveGate />
          <details className={styles.connections}>
            <summary>Connections</summary>
            <div className="flex flex-wrap gap-2 pb-2">
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.gemini ? "bg-success" : "bg-muted/50"}`} />
            Gemini API {health?.gemini ? "connected" : "not configured"}
          </span>
          <span className="chip">
            <span className={`inline-block h-2 w-2 rounded-full ${health?.fal ? "bg-success" : "bg-muted/50"}`} />
            fal.ai {health?.fal ? "connected" : "not configured"}
          </span>
            </div>
          </details>
          {health && !health.live && !health.gemini && !health.fal && (
            <span className="chip border-warning/40 text-warning">
              Demo · no generation charges
            </span>
          )}
        <button
          className="inline-flex min-h-11 items-center text-xs font-semibold text-muted underline underline-offset-4 hover:text-foreground"
          aria-expanded={recoverOpen}
          aria-controls="ad-past-renders"
          onClick={() => {
            setRecoverOpen((v) => !v);
            if (!recent && !recovering) void loadRecent();
          }}
        >
          {recoverOpen ? "Hide past renders" : "Past renders"}
        </button>
        </div>
        <SpendChip amount={sessionSpend} />
      </div>

      {recoverOpen && (
        <div id="ad-past-renders" className="mt-3 rounded-[6px] border border-border-soft bg-surface-2 p-4">
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
                        showCompletedTake(r.videoUrl!, r.requestId);
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
              the model selected in Format — switch models first if the render was
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
          {error && <p className="mt-2 text-xs text-warning">{error.text}</p>}
        </div>
      )}

      {/*
        The receipt for a handover from the Prompts or Blender page.
        
        It names what arrived and, just as importantly, what did not: the
        transfer carries prompt text and settings through sessionStorage, never
        files, and a page that let someone assume otherwise would send them to
        a generation with unresolved tokens.
      */}
      {importSummary.length > 0 && (
        <div
          role="status"
          className="card mt-6 border-accent/30 bg-accent/[0.05] p-4 text-sm leading-relaxed"
        >
          <p>
            <span className="font-bold text-accent">Imported.</span> This lab
            received {listOf(importSummary)}.
          </p>
          <p className="mt-2 text-muted">
            Review the attached files, reference positions and output settings below.
            Missing or expired source files still need attention. Importing never starts a generation.
          </p>
          <a
            href="#ad-prompt"
            className="link-rule mt-3 inline-flex text-[13px]"
          >
            Review prompt <span className="font-mono">↓</span>
          </a>
        </div>
      )}

      {/*
        Only what has nowhere better to be. Compose and generation failures
        render beside their own buttons instead.
      */}
      {error?.at === "page" && (
        <div
          role="alert"
          className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger"
        >
          {error.text}
        </div>
      )}

      {/*
        Which lane you are in changes which steps exist, so it is the first
        decision on the page rather than a toggle buried in the format step.
      */}
      <div className={styles.startingPoint}>
      <p className={styles.eyebrow}>Choose your starting point</p>
      <div className={styles.laneGrid}>
        {(
          [
            {
              id: "recipe" as Lane,
              title: "Start from a concept",
              body: "Choose a concept and product photo. Build and edit the prompt here.",
            },
            {
              id: "blender" as Lane,
              title: "I already have a prompt",
              body: "Bring a Blender brief or your own prompt. Add its references and choose the output.",
            },
          ]
        ).map((l) => (
          <button
            key={l.id}
            onClick={() => switchLane(l.id)}
            aria-pressed={lane === l.id}
            className={`${styles.laneButton} ${lane === l.id ? styles.laneActive : ""}`}
          >
            <h2 className="text-sm font-semibold">{l.title}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{l.body}</p>
          </button>
        ))}
      </div>
      {blenderLane && <p className="mt-3 text-xs text-muted">Need to write the brief first? <Link href="/ai-studio/blender" className="inline-flex min-h-6 items-center font-semibold text-accent underline underline-offset-4">Open the Blender prompt builder ↗</Link></p>}
      </div>

      {referenceManifest.length > 0 && <details className="my-5 rounded-xl border border-border-soft p-4" open={bindingProblems.length > 0}><summary className="min-h-8 cursor-pointer text-sm font-semibold">Imported reference slots · {bindingProblems.length ? "review required before generation" : "all positions match"}</summary><p className="mt-2 text-xs text-muted">Each prompt token must still point to its intended file. Add missing files in References, assign them here, then apply the slot order.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{referenceManifest.map((row, i) => <label key={`${row.token}-${i}`}><span className="label">{refLabel(row.token)} · {row.job}</span><select className="input mt-1" value={row.assetId ?? ""} onChange={(e) => setReferenceManifest((previous) => previous.map((binding, j) => i === j ? { ...binding, assetId: e.target.value || null } : binding))}><option value="">Missing — attach and assign a file</option>{boardReferences.filter((r) => row.token.toLowerCase().startsWith(`[${r.kind}`)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>)}</div><button type="button" className="btn-secondary mt-3" disabled={referenceManifest.some((row) => !row.assetId || !boardReferences.some((r) => r.id === row.assetId))} onClick={() => setRefs((previous) => [...previous].sort((a, b) => { const index = (id?: string) => Number(referenceManifest.find((row) => row.assetId === id)?.token.match(/\d+/)?.[0] ?? 100); return index(a.id) - index(b.id); }))}>Apply declared slot order</button>{bindingProblems.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-warning">{bindingProblems.map((problem, i) => <li key={i}>{problem}</li>)}</ul>}</details>}
      <AdSceneBoard cards={boardCards} onChange={setSceneCards} references={boardReferences} duration={duration} onApply={(text) => { setSceneCards(boardCards); setFinalPrompt((previous) => `${previous.replace(/\n?\n?SCENE BOARD[\s\S]*?END SCENE BOARD/g, "").trim()}\n\nSCENE BOARD\n${text}\nEND SCENE BOARD`); setImported(true); if (!generateLock.current) setPhase("ready"); }} />
      <div className={styles.flow}>
        {/* ---------- the Blender lane opens on the prompt itself ---------- */}
        {blenderLane && (
          <Step
            id="ad-prompt"
          completed={Boolean(finalPrompt)}
            n={STEP.prompt}
            title="Your prompt"
            aside={
              <div className="flex flex-wrap items-center gap-3">
                {importControl}
              </div>
            }
          >
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
              Paste your brief or import its text file. Add the referenced images and clips in the next section.
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
                value={videoPromptFor(modelId, finalPrompt)}
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
        <Step id="ad-concept" completed n={STEP.concept} title="Pick a concept">
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
          id="ad-product"
          completed={Boolean(productImage)}
          n={STEP.product}
          title="Your product"
          aside={
            <button
              className="-my-2 inline-flex items-center py-2 text-xs font-semibold text-muted hover:text-foreground"
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
                    // The product photo rides the same request body as the
                    // references, so it is budgeted against them rather than
                    // being handed the whole allowance twice.
                    const dataUrl = await toProcessedDataUrl(
                      f,
                      inlineWireBytes - (productImage ? wireBytes(productImage) : 0),
                    );
                    setProductImage(dataUrl);
                    void runAutofill(dataUrl, presetId);
                  } catch {
                    fail("Could not read that image");
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

          {/*
            The end frame, on the one endpoint that solves for it.
            
            This is what the single-image endpoint does that the reference one
            cannot: given both ends of a shot it generates only the travel
            between them. It turns "describe where this should end up and pay
            to find out" into a move between two frames you have already
            approved — which is also the natural pairing for the packshot tool
            on this site, since that is where the second frame comes from.
          */}
          {endFrameActive && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[6px] border border-accent/30 bg-accent/[0.04] p-4">
              {endImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={endImage}
                  alt="End frame"
                  className="h-16 w-16 rounded-[6px] border border-border-soft object-cover"
                />
              )}
              <div className="flex flex-col gap-2">
                <button
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => endFrameInput.current?.click()}
                >
                  {endImage ? "Replace end frame" : "Add an end frame (optional)"}
                </button>
                {endImage && (
                  <button
                    className="text-xs font-semibold text-muted hover:text-foreground"
                    onClick={() => {
                      setEndImage(null);
                      invalidatePrompt();
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={endFrameInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    try {
                      setEndImage(await toProcessedDataUrl(f));
                      invalidatePrompt();
                    } catch {
                      fail("Could not read that image");
                    }
                  }
                  e.target.value = "";
                }}
              />
              <p className="min-w-40 flex-1 text-xs leading-relaxed text-muted">
                <span className="font-semibold text-foreground">
                  {modelName} can land on a frame as well as start from one.
                </span>{" "}
                Give it the last frame and it generates only the move between
                the two, so both ends of the shot are settled before you spend
                rather than one end being described and hoped for. Leave it
                empty and the model decides where the shot ends up.{" "}
                <Link href="/ai-studio/packshots" className="font-semibold text-accent hover:underline">
                  Make the second frame in Packshots →
                </Link>
              </p>
            </div>
          )}

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
          id="ad-recipe"
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
            id="ad-refs"
          completed={refs.length > 0}
            n={STEP.refs}
            title="References"
            aside={
              <div className="flex items-center gap-3">
                <span className="label-sm">
                  {(productImage ? 1 : 0) + refs.length + (timingRefActive ? 1 : 0)} of{" "}
                  {referenceCaps.total}
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
            {h3 && <p className="mt-3 text-xs leading-relaxed text-muted">Up to 12 files combined. Video references: 2–15 seconds each, 15 seconds combined. Audio references: the same limits. Appearance images use Image 1, Image 2…; the motion guide is Video 1.</p>}
            {h3InputProblem && <p role="status" className="mt-3 text-sm text-warning">{h3InputProblem}</p>}
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
              <>
              <p className="text-sm leading-relaxed text-muted">Add references in the order your prompt names them. Images, video and audio each have their own numbering.</p>
              <details className={styles.guide}>
                <summary>How reference order and tokens work</summary>
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
                    <span className="font-mono font-semibold text-accent">{refLabel("[Video1]")}</span>
                    <span className="min-w-0 text-muted">
                      <span className="font-semibold text-foreground">The clay control pass.</span>{" "}
                      Camera, blocking, timing, occlusion order and light
                      direction come from here — which is why nothing in this
                      lane asks you to describe them.
                    </span>
                  </li>
                  <li className="flex gap-3 text-xs leading-relaxed">
                    <span className="whitespace-nowrap font-mono font-semibold text-accent">
                      {h3 ? `Image 1…${Math.max(promptSlots.image, 1)}` : `[Image1…${Math.max(promptSlots.image, 1)}]`}
                    </span>
                    <span className="min-w-0 text-muted">
                      <span className="font-semibold text-foreground">The look references</span>, one
                      per mapped ID colour, in the same order the prompt names
                      them. Stills and clips are numbered in separate series,
                      so the clay pass does not consume {refLabel("[Image1]")}.
                    </span>
                  </li>
                </ol>
                <p className="mt-3 border-t border-accent/20 pt-2 text-xs leading-relaxed text-muted">
                  Bind by token, never by filename. The model resolves
                  references positionally and has never seen what your file is
                  called.
                </p>
              </details>
              </>
            )}

            {/* Reference recipe — the concept ships with instructions */}
            {!blenderLane && preset.referenceRecipe && (
              <details className={styles.guide}>
                <summary className="cursor-pointer text-xs font-semibold text-accent">
                  Reference guide · {preset.name}{unmet.length > 0 ? ` · ${unmet.length} important reference${unmet.length === 1 ? "" : "s"} missing` : ""}
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
              <div className="my-4 rounded-lg border border-border-soft bg-background p-3">
                <p className="text-sm font-semibold">Add from project assets</p>
                <p className="mt-1 text-xs text-muted">Use a saved packshot, Blender clip or audio take. Pending outputs are excluded. Adding a file does not start generation or change imported prompt tokens.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
                  <label className="min-w-0"><span className="label">Ready asset</span><select aria-label="Ready project reference" className="input mt-1" value={projectReferenceId} onChange={(event) => { setProjectReferenceId(event.target.value); const reference = projectReferences.find((ref) => ref.id === event.target.value); if (reference) setProjectReferenceRole(referenceRole(reference.kind, reference.role)); }}><option value="">{projectReferences.length ? "Choose a project asset" : "No ready media in this project"}</option>{projectReferences.map((reference) => <option key={reference.id} value={reference.id} disabled={boardReferences.some((attached) => attached.id === reference.id || (attached.dataUrl ?? attached.url) === (reference.dataUrl ?? reference.url))}>{reference.name} · {reference.kind}{boardReferences.some((attached) => attached.id === reference.id) ? " · attached" : ""}</option>)}</select></label>
                  <label><span className="label">Reference role</span><select aria-label="Project reference role" className="input mt-1" disabled={!selectedProjectReference} value={projectReferenceRole} onChange={(event) => setProjectReferenceRole(event.target.value as ReferenceRole)}>{REFERENCE_ROLES.filter((role) => !selectedProjectReference || (role.media as readonly string[]).includes(selectedProjectReference.kind)).map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}</select></label>
                  <button type="button" className="btn-secondary self-end" disabled={!selectedProjectReference || uploading} onClick={addProjectReference}>Add selected asset</button>
                </div>
                {selectedProjectReference?.kind === "image" && <img src={selectedProjectReference.dataUrl ?? selectedProjectReference.url} alt={selectedProjectReference.name} className="mt-3 h-24 max-w-full rounded object-contain" />}
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
                  aria-label="Reference URL"
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
                  Stills · JPG, PNG, WebP · up to {referenceCaps.image}
                </span>
                <span
                  className={`chip ${clipsUploadable ? "border-warning/40 !text-warning" : "opacity-55"}`}
                >
                  Clips · {VIDEO_REF_LIMITS.formats} · ≤
                  {health?.blob ? VIDEO_REF_LIMITS.maxMBDirect : VIDEO_REF_LIMITS.maxMB}MB ·{" "}
                  {h3 ? "2–15s each · 15s combined" : `~${VIDEO_REF_LIMITS.idealSeconds}s`}
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
                    <p className="font-mono text-[11px] text-accent">{refLabel("[Image1]")}</p>
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
                        {refLabel(token)}
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
                        aria-label={`Job for ${refLabel(token)}`}
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
                      {refLabel(`[Audio${refs.filter((r) => r.media === "audio").length + 1}]`)}
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
            <details className={styles.guide}>
              <summary>Browse starter motion clips <span className="font-normal text-muted">· optional</span></summary>
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
            </details>

          </Step>
        )}

        {/* ---------- 7. compose ---------- */}
        {/* ---------- 5. format — after references, which change the bill ---------- */}
        <Step
          id="ad-format"
          completed
          n={STEP.format}
          title="Format and cost"
          aside={
            <span className="chip border-accent/40 !text-accent">
              {outputSizeLabel} · {duration}s · ~${videoCost.toFixed(2)}
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
                setFinalPrompt((prompt) => videoPromptFor(e.target.value, prompt));
                if (!imported) setSeconds(null);
                invalidatePrompt();
              }}
            >
              {AD_VIDEO_MODELS.map((m) => (
                <option key={m} value={m}>
                  {MODELS[m].label} —{" "}
                  {m === H3_MODEL_ID ? "$0.08/s at 768p + reference inputs" : usesTokenPricing(m)
                    ? `~$${MODELS[m].unitCost}/s at 720p, by token`
                    : `$${MODELS[m].unitCost}/s`}
                </option>
              ))}
            </select>
          </label>
          <details className={styles.guide}>
            <summary>How this model uses references</summary>
            <p className="pb-3 text-xs leading-relaxed text-muted">
              {supportsRefs
                ? `Reference-to-video: each file has a position in the prompt (${refLabel("[Image1]")}, ${refLabel("[Video1]")}, ${refLabel("[Audio1]")}…). References guide identity and motion; review the result for drift.`
                : endFrameActive
                  ? "First frame and, optionally, last frame: give it both ends and it generates only the move between them, which is the tightest control available without a clay pass. No video input means no input duration on the bill, so it is markedly cheaper than the reference endpoint — the trade is that identity is held by one still rather than several."
                  : "Single grounding frame: the product photo conditions the first frame, then the model extrapolates. Cheaper, but the pack can drift as the camera moves."}
            </p>
          </details>

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
                {modelName} renders {allowedAspects.length} shapes. H3 Max and Seedance Reference
                add square, portrait, 4:3 and cinematic — useful when one
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
            {allowedDurations ? (
              <div className="flex gap-2">
                {allowedDurations.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSeconds(d)}
                    className={`flex-1 rounded-[6px] border px-3 py-2 text-sm font-semibold transition ${
                      duration === d
                        ? "border-accent bg-accent/[0.05] text-accent"
                        : "border-border-soft bg-surface hover:border-accent/40"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="range"
                min={minAdSeconds(modelId)}
                max={secondsCap}
                step={1}
                value={duration}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            )}
            <span className="mt-1 block text-xs leading-relaxed text-muted">
              {allowedDurations
                ? `This model renders ${allowedDurations.join("s or ")}s only — the endpoint takes those two lengths and rejects anything between them.`
                : secondsCap >= 30
                  ? "Seedance 2.5 renders up to 30s in a single pass — no stitching."
                  : `This model caps at ${secondsCap}s.`}{" "}
              {!imported && <>The concept is designed for {preset.durationSeconds}s.</>}
            </span>
          </label>

          {/* Resolution + live cost */}
          {h3 ? <H3VideoSettings resolution={resolution} onChange={setResolution} seconds={duration} imagePixels={referenceImagePixels} videoSeconds={inputVideoSeconds} audioSeconds={inputAudioSeconds} pending={Boolean(h3InputProblem)} /> : tokenBilled ? (
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
          id="ad-sound"
          completed={Boolean(soundPlan) && !soundPlanIssue}
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
          <details className={styles.guide}>
            <summary>ElevenLabs connection &amp; audio delivery</summary>
            <p className="text-xs font-semibold">{health === null ? "Checking configuration…" : health.fal ? "Connected through your fal key" : "fal key not configured"}</p>
            <p className="mt-1 pb-3 text-xs leading-relaxed text-muted">Music, voiceover and sound effects use your existing fal connection. No separate ElevenLabs key is needed. This checks key presence; model access and balance are verified when you generate.</p>
          </details>
          {health && !health.live && <p className="mt-3 text-xs leading-relaxed text-warning">Audio is in demo mode. Preview tones are mocks, not ElevenLabs output. {gateable && <button type="button" className="min-h-11 font-semibold underline" onClick={requestLiveUnlock}>Unlock live audio</button>}</p>}
          {health?.live && !health.fal && <p className="mt-3 text-xs text-warning">Connect fal to generate ElevenLabs voice, music and sound effects.</p>}

          {legacyPlan && <div className="my-3 rounded-lg border border-border-soft p-3 text-xs"><p>A sound plan from the previous version is still saved on this device.</p><button type="button" className="min-h-11 font-semibold text-accent underline" onClick={() => { setSoundPlan(legacyPlan); setLegacyPlan(null); }}>Import previous local sound plan into this project</button></div>}
          <SoundPlanner takes={voiceTakes} onTakesChange={setVoiceTakes} recoveredVoices={audioJobs.jobs.filter((job): job is typeof job & { audioUrl: string } => job.modelId === "eleven-voice" && Boolean(job.audioUrl))} plan={soundPlan} onChange={(plan) => { setSoundPlan(plan); if (plan?.narration === "native" && soundPlan?.narration !== "native" && cap.native) setAudioMode("native"); }}
            duration={duration} problem={soundPlanIssue} onMatchDuration={setSeconds}
            canMatchDuration={Boolean(soundPlan && planSeconds(soundPlan) <= secondsCap && snapAdSeconds(modelId, planSeconds(soundPlan)) === planSeconds(soundPlan))}
            busy={audioJobs.busy || phase === "starting"} live={health?.live ?? false}
            scoreToPlan={scoreToPlan} onScoreToPlan={(enabled) => { setScoreToPlan(enabled); if (enabled) { setAudioMode("layered"); if (musicStyleId === NO_MUSIC_ID) setMusicStyleId("premium-cinematic"); } }}
            onVoice={async (body, label) => { const result = await audioJobs.run("/api/ad/voice", body, label); if (!result.mock) keepAudio(result.audioUrl, label, "Voice · separate take"); return result; }} />

          {project?.example === "velune" && effectCues.some((cue) => cue.id.startsWith("velune-fx-")) && <div className="my-4 rounded-xl border border-border-soft bg-surface-2 p-4 sm:p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">VELUNE · picture first, sound after</p>
            <p className="mt-2 text-sm leading-relaxed">The voice lines, music brief and spot-effect cues are loaded. Audition the voice, then generate the picture with {h3 ? "External soundtrack" : "Silent"} selected. {h3 && "H3 may return native audio; mute or discard it in the final edit."} Once the edit is settled, enable “Compose music to these scene lengths” and generate the instrumental track. Keep “Use this track as an audio reference” off for this workflow.</p>
            <p className="mt-2 text-xs leading-relaxed text-muted">Ready voice and effect takes carry their planned positions into Local finishing. Listen and trim silence before exporting the mixed WAV. Enabling composition switches to Layered sound; choose {h3 ? "External soundtrack" : "Silent"} again before any picture retry.</p>
            <details className="mt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-accent">Preview the loaded music brief</summary><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{musicCustomPrompt}</p></details>
          </div>}

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

          <details className="mt-4 rounded-[6px] border border-border-soft p-3">
            <summary className="cursor-pointer text-sm font-semibold">Sound direction sent with the video</summary>
            <p className="mt-2 text-xs leading-relaxed text-muted">This block is appended to the video prompt, including imported Blender briefs. It changes sound instructions only. Silent mode also switches native audio off at the API where supported.</p>
            <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">{soundBlock}</pre>
          </details>

          {audioError && <p role="alert" className="mt-3 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{audioError}</p>}
          {audioRefProblem && <p role="alert" className="mt-3 rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{audioRefProblem}</p>}

          {audioMode !== "silent" && (
            <label className="mt-4 block max-w-md">
              <span className="mb-1 block label">Music style</span>
              <select
                className="input"
                value={musicStyleId}
                onChange={(e) => {
                  setMusicStyleId(e.target.value);
                  setMusicCustomPrompt("");
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
                    connect, and the configuration status above shows whether that key is present.
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

          {/* A separate instrumental score, optionally structured by scene. */}
          {scoringSeparately && (
            <div className="mt-4 border-t border-border-soft pt-4">
              <label className="mb-3 block">
                <span className="label">Custom music brief (optional)</span>
                <textarea className="input mt-2 min-h-24" maxLength={2000} value={musicCustomPrompt} onChange={(e) => setMusicCustomPrompt(e.target.value)} placeholder="Describe instruments, tempo, mood and how the score should build and end." />
              </label>
              <button type="button" className="mb-3 min-h-11 text-sm font-semibold text-accent underline underline-offset-4" onClick={() => { setMusicStyleId("premium-cinematic"); setMusicCustomPrompt(ICE_CREAM_MUSIC_BRIEF); }}>Use the Cream in motion music brief</button>
              <p className="mb-3 text-xs leading-relaxed text-muted">{musicComposition ? "The scene plan sets section lengths and requests an instrumental score with no lyrics. Audition it for unwanted vocals." : "Instrumental only is enforced in the ElevenLabs request."} Music is estimated at $0.60 per started minute: a short ad track is about $0.60 each time you generate it.</p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => void generateMusic()}
                  disabled={audioJobs.busy || phase === "starting" || Boolean(musicComposition && soundPlanIssue)}
                >
                  {musicBusy
                    ? "Composing…"
                    : musicUrl
                      ? `Generate another track (~$${musicCost.toFixed(2)})`
                      : `Generate instrumental (${musicSeconds}s, ~$${musicCost.toFixed(2)})`}
                </button>
                {musicReady && <span className="chip border-success/40 !text-success">{musicMock ? "Demo tone — not ElevenLabs output" : "ElevenLabs track ready"}</span>}
              </div>
              {musicUrl && !musicReady && <p className="mt-2 text-xs text-warning">This track belongs to earlier sound settings. You can still download it, but it will not be attached to the new brief. Generate a matching track first.</p>}

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
                    {musicComposition ? "Requested to match the scene lengths exactly. Audition the musical accents against the picture." : musicAsTimingRef ? "For reference use, the requested duration matches the cut. The file’s actual duration is checked before submission." : `Requested with ${MUSIC_HANDLE_SECONDS}s of trim handles. Align and finish the mix in your editor.`}
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
                        Use this track as an audio reference
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        The track is sent as{" "}
                        <span className="font-mono text-accent">{refLabel(`[Audio${refs.filter((r) => r.media === "audio").length + 1}]`)}</span>.
                        It can guide rhythm and mood. For Blender films, keep the camera plan and cut timing in charge; exact beat sync is not guaranteed.
                      </span>
                    </span>
                  </label>
                  {musicAsTimingRef && !musicReady && (
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
                        {(h3 ? ["H3 Max accepts 2–15 seconds per audio file and at most 15 seconds combined, alongside an image or video. All modalities share a 12-file limit.", "Audio can guide mood and rhythm; unchanged stems or exact beat alignment are not guaranteed.", ...TIMING_REF_NOTES.filter((note) => !note.startsWith("Seedance"))] : TIMING_REF_NOTES).map((c) => (
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
                    : "Budget an alignment pass in the editor, choose a reference-video model to feed the track back as a timing signal, or pick a pad-like style that hides drift."}
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

          {audioJobs.jobs.length > 0 && <details className="mt-4 rounded-[6px] border border-border-soft bg-surface-2 p-3" open>
            <summary className="cursor-pointer text-sm font-semibold">Audio requests · saved on this browser</summary>
            <p className="mt-2 text-xs text-muted">A slow request can be checked again without generating or charging for another track. Saved downloads remain available after a reload.</p>
            <ul className="mt-3 space-y-3">{audioJobs.jobs.map((job) => <li key={job.requestId} className="rounded border border-border-soft p-3">
              <p className="text-sm">{job.label}</p><code className="mt-1 block break-all text-[11px] text-muted">{job.requestId}</code>
              {job.audioUrl ? <div className="mt-2"><audio src={job.audioUrl} controls preload="none" className="w-full max-w-sm" /><a href={job.audioUrl} target="_blank" rel="noreferrer" download className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline">Download audio</a></div> : <button type="button" className="btn-secondary mt-2" disabled={audioJobs.busy} onClick={() => { setAudioError(null); void audioJobs.resume(job).catch((e) => setAudioError(e instanceof Error ? e.message : "Could not check audio")); }}>{audioJobs.busy ? "Checking audio…" : "Check result · no new generation"}</button>}
            </li>)}</ul>
          </details>}

          {(
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
                  {Object.keys(sfxTracks).length} of {effectLines.length} generated ·
                  {effectCues.length ? "lengths set per cue" : `~$${sfxCost.toFixed(3)} each`}
                </span>
              </summary>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
                Optional sounds for the final edit, available with any sound mode. Describe one physical event per generation, audition it, then place it against the picture. These files are not automatically mixed into the MP4.
              </p>
              <label className="mt-3 block"><span className="label">Describe a spot effect</span><input className="input mt-1" maxLength={600} value={customEffect} onChange={(e) => setCustomEffect(e.target.value)} placeholder="Close, dry scrape of a stainless spoon through dense frozen cream" /></label>
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" className="btn-secondary" disabled={!customEffect.trim()} onClick={() => { setExtraEffects((previous) => [...previous, customEffect.trim()]); setCustomEffect(""); }}>Add to effects list</button>
                <button type="button" className="min-h-11 text-sm font-semibold text-accent underline" onClick={() => setExtraEffects((previous) => [...previous, "Close, dry scrape of a stainless spoon through dense frozen ice cream, soft granular texture, no music or speech.", "A paper ice-cream tub settling softly on stone, followed by a light lid click; close microphone, short natural tail, no music."])}>Add ice-cream examples</button>
              </div>

              <label className="mt-3 flex flex-wrap items-center gap-3">
                <span className="label">{effectCues.length ? "Custom effect length" : "Length"}</span>
                <input
                  type="range"
                  min={SFX_LIMITS.minSeconds}
                  max={SFX_LIMITS.maxSeconds}
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
                {effectLines.map((line, i) => {
                  const cue = effectCues.find((item) => item.prompt === line);
                  return <li
                    key={i}
                    className="rounded-[6px] border border-border-soft bg-surface p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-64 text-xs leading-relaxed text-muted">
                        {cue && <p className="mb-1 font-semibold text-foreground">{cue.name} · place at {cue.placements.map((p) => `${p.start.toFixed(3)}s`).join(", ")}</p>}
                        <p>{line}</p>
                        {cue && <><p className="mt-1">{cue.note}</p><label className="mt-2 flex items-center gap-2">Generate length · s<input aria-label={`${cue.name} generation seconds`} type="number" min={0.5} max={22} step={0.1} value={cue.seconds} onChange={(e) => setEffectCues((previous) => previous.map((item) => item.id === cue.id ? { ...item, seconds: Math.min(22, Math.max(0.5, Number(e.target.value))) } : item))} className="input !w-20" /><span>~${estimateCost(SFX_MODEL_ID, { seconds: cue.seconds }).toFixed(3)}</span></label></>}
                      </div>
                      <button
                        className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs"
                        onClick={() => void generateSfx(line)}
                        disabled={audioJobs.busy || phase === "starting"}
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
                        <p className="mb-2 text-xs text-muted">{sfxMocks[line] ? "Demo noise — not an ElevenLabs effect" : "ElevenLabs effect · separate audio file"}</p>
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
                  </li>;
                })}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Generate one physical event at a time. Recipe effects and your
                added sounds are separate files to place against the action in
                your editor.
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
          id="ad-prompt"
          completed={Boolean(finalPrompt)}
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

          {error?.at === "compose" && (
            <p
              role="alert"
              className="mt-4 rounded-[6px] border border-danger/50 bg-danger/10 p-3 text-sm leading-relaxed text-danger"
            >
              <span className="font-bold">Compose failed.</span> {error.text}{" "}
              Everything you entered is still here — fix what it names and press
              Compose again.
            </p>
          )}

          {imported && (
            <p className="mt-4 rounded-[6px] border border-accent/30 bg-accent/[0.05] p-3 text-xs leading-relaxed text-muted">
              <span className="font-bold text-accent">From the prompt library.</span>{" "}
              Loaded to run as-is, with the length it was written for. It has
              no recipe behind it. Review its attached reference slots before spending;
              composing from the recipe above will replace it.
            </p>
          )}
          {finalPrompt && (
            <>
              <label className="mt-5 block">
                <span className="mb-1 block label">Video prompt — edit before you spend</span>
                <textarea
                  className="input min-h-40 font-mono text-xs leading-relaxed"
                  value={videoPromptFor(modelId, finalPrompt)}
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
        <Step id="ad-generate" n={STEP.generate} title="Generate">
          {bindingProblems.length > 0 && <p role="alert" className="mb-3 text-sm text-warning">{bindingProblems.join(" ")}</p>}
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

          <div className={styles.renderSummary}>
            <div className={styles.renderMeta}>
              <p className="mb-2 text-sm font-semibold">{modelName}</p>
              <p>{duration}s · {aspect} · {outputSizeLabel}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className={styles.renderCost}>~${cost.toFixed(2)}</span>
                <span className="text-xs">estimated total</span>
              </div>
              {scoringSeparately && (
                <span className="block text-xs">
                  video ${videoCost.toFixed(2)} + {musicReady ? "existing music $0 additional" : `new music $${musicCost.toFixed(2)}`}
                </span>
              )}
              {health && !health.live && (
                <span className="mt-1 block text-xs text-warning">Demo mode · no generation charge</span>
              )}
            </div>
            <button
              className={flagged ? "btn-secondary !border-warning !text-warning" : "btn-primary"}
              disabled={
                !hydrated || draftSaveBlocked || bindingProblems.length > 0 || !finalPrompt || blockedOnMusic || Boolean(audioRefProblem) || Boolean(soundPlanIssue) || audioJobs.busy || phase === "starting" || phase === "polling"
              }
              onClick={() => void generate()}
            >
              {flagged ? "Generate anyway →" : "Generate ad →"}
            </button>
          </div>
          {nextUp.href !== "#ad-generate" && <p className="mt-4 text-sm leading-relaxed text-muted">Before you render: <a href={nextUp.href} className="inline-flex min-h-6 items-center font-semibold text-accent underline underline-offset-4">{nextUp.label} ↗</a></p>}
        </Step>


        {(phase === "starting" || phase === "polling" || phase === "done" || phase === "mock" || phase === "failed" || Boolean(completedTake)) && (
          <div id="ad-result" tabIndex={-1} aria-label="Video render and review" className={`card overflow-hidden ${styles.resultCard}`}>
            {videoUrl && <div className={styles.resultHeading}><div><p className={styles.resultKicker}>01 · Watch the take</p><h2 className="mt-2 text-2xl tracking-tight">Your film is ready.</h2></div><div className="flex flex-wrap items-center gap-4"><p className={styles.resultSpec}>{videoMetadata ? `${videoMetadata.durationSeconds.toFixed(1)}s · ${videoMetadata.width} × ${videoMetadata.height}` : "Loading video details"}</p>{completedTake && <button type="button" className={styles.reviewStatus} onClick={() => showResultSection("ad-preflight")}>Checklist · {takeReviewState === "reviewed" ? "findings ready" : takeReviewState === "reviewing" ? "reviewing" : takeReviewState === "incomplete" ? "needs attention" : "not reviewed"}<span aria-hidden>↘</span></button>}</div></div>}
            <div className={videoUrl ? styles.cinemaStage : "mx-auto w-full max-w-md"}>
              <div className={`relative w-full ${videoUrl ? "bg-black" : "bg-surface-2"} ${rendering ? "" : ASPECT_CLASS[completedTake?.context?.aspect ?? aspect] ?? "aspect-[16/9]"}`} style={videoUrl ? { ...(videoMetadata ? { aspectRatio: `${videoMetadata.width} / ${videoMetadata.height}` } : {}), maxWidth: videoMetadata ? `min(840px, calc(clamp(240px, 100svh - 440px, 560px) * ${videoMetadata.width / videoMetadata.height}))` : 840 } : undefined}>
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    id="ad-result-video"
                    src={videoUrl}
                    controls
                    playsInline
                    className="absolute inset-0 h-full w-full object-contain"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      setVideoMetadata({ durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight });
                    }}
                    onPlay={() => { setResultNotice(false); syncAudio("play"); }}
                    onPause={() => syncAudio("pause")}
                    onSeeked={() => syncAudio("seek")}
                    onRateChange={() => syncAudio("seek")}
                    onWaiting={() => syncAudio("pause")}
                    onPlaying={() => syncAudio("play")}
                    onTimeUpdate={() => {
                      const v = videoRef.current; const a = audioRef.current;
                      if (v && a && !v.paused && !a.paused && Math.abs(v.currentTime - a.currentTime) > 0.2) a.currentTime = Math.min(v.currentTime, a.duration || v.currentTime);
                    }}
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
                  <div className={rendering ? "w-full" : "absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-muted"}>
                    {phase === "failed" ? (
                      <div className="max-w-[85%] text-center">
                        <p role="alert" className="text-danger">
                          {error?.text}
                        </p>
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
                      <RenderWaiting
                        starting={phase === "starting"}
                        overdue={elapsedMs >= OVERDUE_MS}
                        elapsed={elapsedLabel(elapsedMs)}
                        modelName={modelName}
                        requestId={pendingJob?.falRequestId ?? pendingJob?.operationName}
                        contactHref={STUCK_RENDER_MAILTO}
                      />
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

            {videoUrl && completedTake && <div className={styles.resultBridge}>
              <div className="min-w-0"><p className={styles.resultKicker}>Next · Inspect before you ship</p><p role="status" className="mt-2 text-sm leading-relaxed">{takeReviewState === "reviewing" ? "AI is inspecting this take. You can keep watching." : takeReviewState === "reviewed" ? "AI findings are ready. Human sign-off is still required." : takeReviewState === "incomplete" ? "The video is saved. Its AI review still needs attention." : "Picture complete. The checklist is your next step."}</p></div>
              <div className={styles.resultActions}>
                <button type="button" className={styles.reviewTakeButton} onClick={() => showResultSection("ad-preflight")}>{takeReviewState === "reviewed" ? "See review findings" : takeReviewState === "reviewing" ? "View review progress" : takeReviewState === "incomplete" ? "Review needs attention" : "Review this take"}<span aria-hidden>↓</span></button>
                <a href={videoUrl} download={`${preset.id}-ad.mp4`} target="_blank" rel="noreferrer" className={styles.resultDownload}>Download MP4 ↗</a>
              </div>
              <p className={styles.resultFootnote}>Opening the checklist is free. AI inspection runs only when you choose it. The MP4 keeps its original audio.</p>
            </div>}

            {completedTake && videoUrl && <AdPreflight
              key={`${completedTake.id}:${completedTake.videoUrl}`}
              take={completedTake}
              metadata={videoMetadata}
              referenceImages={completedTake.referenceImages ?? []}
              health={health}
              onSpend={addSpend}
              onStateChange={updateReviewProgress}
              onSeek={(seconds) => {
                const video = videoRef.current;
                if (!video) return;
                video.pause();
                audioRef.current?.pause();
                video.currentTime = Math.max(0, Math.min(seconds, video.duration || seconds));
                video.focus({ preventScroll: true });
                video.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
              }}
            />}

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
              <div className="border-t border-border-soft p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold">Keep working with this take</p><a href="#ad-finish" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent underline underline-offset-4">Finish the soundtrack ↓</a></div>
                {musicReady && musicUrl && scoringSeparately && (
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
                          else if (!videoRef.current?.paused) syncAudio("play", true);
                        }}
                      />
                      Play music bed with the video
                    </label>
                    <label className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted"><span>Music preview level</span><input aria-label="Music preview level" type="range" min={0} max={1} step={0.05} value={musicVolume} onChange={(e) => setMusicVolume(Number(e.target.value))} /><span>{Math.round(musicVolume * 100)}%</span></label>
                    <p className="mb-3 text-xs text-muted">Preview mix only. Download MP4 contains the video model’s audio; download the music separately and combine them in your editor. If the generated video already includes the reference music, turn off this extra layer to avoid doubling it.</p>
                  </>
                )}
                <details className="mb-3 rounded-[6px] border border-border-soft bg-surface-2 p-3">
                  <summary className="cursor-pointer text-xs font-semibold text-foreground">
                    Want to change one thing? Read this before re-rendering
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Generating again buys a new take. A video reference can add
                    input charges, and pricing depends on the selected model.
                    For small changes, start with the saved MP4:
                  </p>
                  <ol className="mt-2 space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
                    <li className="list-decimal">
                      <strong>Grade it in your editor.</strong> For a
                      background colour shift, a hue qualifier in Resolve or
                      Premiere is free, instant, and does not risk the product
                      drifting.
                    </li>
                    <li className="list-decimal">
                      <strong>Update the reference for a new take.</strong>{" "}
                      Recolour the background on your product still with an
                      image model, swap it in as the reference, and re-run. On a
                      reference-to-video model the render follows the reference,
                      so this is the controllable way to change what is in the
                      frame.
                    </li>
                    <li className="list-decimal">
                      <strong>Use a draft resolution first.</strong> If the change is
                      to the action, check the model&apos;s lower-resolution price
                      before spending on a full-quality version.
                    </li>
                  </ol>
                </details>
                <div className="flex gap-3">
                  {!completedTake && <a
                    href={videoUrl}
                    download={`${preset.id}-ad.mp4`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-accent hover:underline"
                  >
                    Download original MP4 · native audio unchanged
                  </a>}
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
        {resultNotice && completedTake && videoUrl && <aside className={styles.resultNotice} aria-label="Completed render notification"><div><p role="status" className="text-sm font-semibold">Your take is ready.</p><button type="button" onClick={() => showResultSection("ad-result")} className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold underline underline-offset-4">Watch & review <span aria-hidden>↗</span></button></div><button type="button" aria-label="Dismiss completed render notification" onClick={() => setResultNotice(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 text-lg">×</button></aside>}
        <AdFinishing key={project?.id ?? "loading"} tracks={mixTracks} onChange={setMixTracks} available={availableMixTracks} duration={finishingDuration} ducking={ducking} onDucking={setDucking} videoUrl={completedTake?.videoUrl ?? (project?.example === "velune" ? project.assets.find((asset) => asset.id === "velune-motion" && asset.status === "ready")?.url ?? null : null)} sceneCards={finishingScenes} onSaveMix={async (dataUrl, manifest) => { const id = `ad-mix-${crypto.randomUUID()}`; await saveAsset({ id, name: "Ad Lab · mixed soundtrack.wav", kind: "audio", dataUrl, role: "Mixed separate soundtrack · place at zero; original video audio unchanged", source: "generated", status: "ready", metadata: manifest }); await saveAsset({ id: `${id}-settings`, name: "Ad Lab · editor cue bundle settings", kind: "document", dataUrl: adDocumentDataUrl({ ...manifest, sceneCues: finishingScenes }), role: "Editor handoff · separate video and soundtrack", source: "generated", status: "ready" }); }} />
      </div>
    </div>
  );
}
