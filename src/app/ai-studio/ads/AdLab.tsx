"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AD_PRESETS,
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
import { MODELS, estimateCost } from "@/lib/models";
import {
  LAYER_NOTES,
  SFX_LIMITS,
  SFX_MODEL_ID,
  SFX_PROMPT_TIPS,
  clampSfxSeconds,
} from "@/lib/sfx";

type Phase = "idle" | "composing" | "ready" | "starting" | "polling" | "done" | "failed" | "mock";

const SPEND_KEY = "studio-session-spend";
const POLL_INTERVAL_MS = 12_000;
const POLL_DEADLINE_MS = 10 * 60 * 1000;
const ASPECT_CLASS: Record<string, string> = {
  "9:16": "aspect-[9/16]",
  "16:9": "aspect-[16/9]",
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

export function AdLab() {
  const [health, setHealth] = useState<{ gemini: boolean; fal: boolean; live: boolean } | null>(null);
  const [presetId, setPresetId] = useState<string>(AD_PRESETS[0].id);
  const [params, setParams] = useState<Record<string, string>>({});
  const [productImage, setProductImage] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>("veo-3.1-fast");
  const [finalPrompt, setFinalPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const refInput = useRef<HTMLInputElement>(null);

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
  const videoCost = estimateCost(modelId, { seconds: duration });
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

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h) => setHealth({ gemini: h.gemini, fal: h.fal, live: h.live }))
      .catch(() => setHealth({ gemini: false, fal: false, live: false }));
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
      setEditingRecipe(false);
      setMusicStyleId(next.musicStyleId);
      if (next.preferredModelId) setModelId(next.preferredModelId);
      setMusicUrl(null);
      setMusicAsTimingRef(false);
      setSfxTracks({});
      setSeconds(null);
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
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compose failed");
      setPhase("idle");
    }
  }, [
    audioMode,
    composeRefs,
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
              `${isAudio ? "Tracks" : "Clips"} upload to the generation provider, so they need live mode — and this session is in demo mode. Unlock live mode in the header, or use image references, which stay in the browser.`,
            );
            return;
          }
          // Check size locally too — no point spending upload time on a file
          // the server is going to reject.
          if (file.size > limits.maxBytes) {
            setRefError(
              isAudio
                ? `That track is ${(file.size / 1024 / 1024).toFixed(1)}MB. Trim it under ${limits.maxMB}MB — the reference only needs to be as long as the cut.`
                : `That clip is ${(file.size / 1024 / 1024).toFixed(1)}MB. Trim it under ${limits.maxMB}MB — around ${VIDEO_REF_LIMITS.idealSeconds} seconds is all the model reads.`,
            );
            return;
          }
          // Clips and tracks upload to the provider once and travel as a URL —
          // inlining them as base64 would blow past the request size limit.
          setUploading(true);
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
          setRefs((prev) => [
            ...prev,
            {
              url: json.url,
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
          aspect: preset.aspect,
          durationSeconds: duration,
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
          return;
        }
        if (status?.status === "failed") {
          throw new Error(status.error ?? "Generation failed");
        }
      }
      throw new Error("Timed out after 10 minutes — the job may still finish on the provider side.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
      setPhase("failed");
    }
  }, [
    addSpend,
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
    productImage,
    refs,
    scoringSeparately,
    supportsRefs,
    timingRefActive,
  ]);

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
          {health && !health.live && (
            <span className="chip border-warning/40 text-warning">
              Demo mode — zero-cost mocks; add API keys to go live
            </span>
          )}
        </div>
        <span className="chip">Session spend: ${sessionSpend.toFixed(2)}</span>
      </div>

      <h1 className="mt-6 text-[1.75rem] tracking-[-0.03em]">Ad Lab</h1>
      <p className="mt-2 max-w-3xl text-muted">
        Mini product ads as <span className="font-semibold text-foreground">preset recipes</span>:
        each concept is a structured, deconstructed prompt — aesthetics, beat-by-beat
        action, text overlay spec, sound design — with the product swappable per
        SKU. Design the concept once; run any product through it, and edit any
        part of it when the brief moves.
      </p>

      {error && (
        <div className="card mt-6 border-danger/50 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      )}

      <div className="mt-8 space-y-6">
        {/* ---------- 1. concept ---------- */}
        <Step n={1} title="Pick a concept">
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

        {/* ---------- 2. the recipe ---------- */}
        <Step
          n={2}
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
            {editingRecipe
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
                    Effects and ambience only — music is set in step 5.
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
                    product fields in step 3.
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

        {/* ---------- 3. product ---------- */}
        <Step
          n={3}
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

        {/* ---------- 4. model & shot ---------- */}
        <Step n={4} title="Model and shot">
          <div className="mt-4 grid gap-5 md:grid-cols-2">
            <label className="block">
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
                    {MODELS[m].label} — ${MODELS[m].unitCost}/s
                  </option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-relaxed text-muted">
                {supportsRefs
                  ? "Reference-to-video: every uploaded reference is addressed positionally in the prompt ([Image1], [Video1], [Audio1]…), which is what stops the product drifting as the camera moves."
                  : "Single grounding frame: the product photo conditions the first frame, then the model extrapolates. Cheaper, but the pack can drift as the camera moves."}
              </span>
            </label>

            {/* Duration — Seedance 2.5 does native 30s takes */}
            <label className="block">
              <span className="mb-1 flex items-center justify-between label">
                <span>Duration</span>
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
              <span className="mt-2 block text-xs leading-relaxed text-muted">
                {secondsCap >= 30
                  ? "Seedance 2.5 renders up to 30s in a single pass — no stitching."
                  : `This model caps at ${secondsCap}s.`}{" "}
                {preset.aspect} · {preset.durationSeconds}s is the concept&apos;s
                designed length.
              </span>
            </label>
          </div>
        </Step>

        {/* ---------- 5. sound ---------- */}
        <Step
          n={5}
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
                className={`flex cursor-pointer gap-2 rounded-[6px] border p-3 transition ${
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
                <span className="mt-2 block rounded-[6px] border border-border-soft bg-surface-2 p-2.5 text-xs leading-relaxed text-muted">
                  {MUSIC_STYLES.find((m) => m.id === musicStyleId)?.prompt}
                </span>
              )}
            </label>
          )}

          {/* Spot effects — available whenever effects are being built outside
              the video model, which is both layered and silent. */}
          {audioMode !== "native" && recipe.sfx.length > 0 && (
            <div className="mt-4 border-t border-border-soft pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  Spot effects — {MODELS[SFX_MODEL_ID].label.split(" (")[0]}
                </h3>
                <span className="label-sm">~${sfxCost.toFixed(3)} each</span>
              </div>
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
                in step 2 to change what gets generated.
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
            </div>
          )}

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
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">
                      {TIMING_REF_NOTES.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
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
        </Step>

        {/* ---------- 6. references ---------- */}
        {supportsRefs && (
          <Step
            n={6}
            title="References"
            aside={
              <span className="label-sm">
                {(productImage ? 1 : 0) + refs.length + (timingRefActive ? 1 : 0)} of{" "}
                {REF_CEILINGS.total}
              </span>
            }
          >
            {/* Reference recipe — the concept ships with instructions */}
            {preset.referenceRecipe && (
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
                      <select
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
                      Musical timing — your composed bed, from step 5
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              className="btn-secondary mt-3 !px-3 !py-1.5 text-xs"
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
                Clips · {VIDEO_REF_LIMITS.formats} · ≤{VIDEO_REF_LIMITS.maxMB}MB ·{" "}
                ~{VIDEO_REF_LIMITS.idealSeconds}s
              </span>
              <span
                className={`chip ${clipsUploadable ? "border-warning/40 !text-warning" : "opacity-55"}`}
              >
                Tracks · {AUDIO_REF_LIMITS.formats} · ≤{AUDIO_REF_LIMITS.maxMB}MB
              </span>
            </div>

            {!clipsUploadable && (
              <p className="mt-2 max-w-3xl rounded-[6px] border border-warning/40 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
                <span className="font-bold">Uploads need live mode.</span>{" "}
                Images are processed in your browser, but clips and tracks are
                uploaded to the generation provider. Unlock live mode in the
                header — or paste a URL above, which skips the upload entirely.
              </p>
            )}
            <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
              <span className="font-semibold text-foreground">
                Uploading and pasting a URL are different paths.
              </span>{" "}
              An upload goes through fal&apos;s storage service, which is
              permissioned separately from generation — so a key that renders
              video fine can still be refused a file upload. A URL is handed
              straight to the model, so it needs no upload, no live mode and no
              storage access. It has to be a direct link to the file (ending in
              .mp4, .mov, .mp3…) that fal can reach without signing in.
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
          </Step>
        )}

        {/* ---------- 7. compose ---------- */}
        <Step n={supportsRefs ? 7 : 6} title="Compose the prompt">
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

        {/* ---------- 8. generate ---------- */}
        <Step n={supportsRefs ? 8 : 7} title="Generate">
          {unmet.length > 0 && (
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
              {duration}s · {preset.aspect} ·{" "}
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
              className={unmet.length > 0 ? "btn-secondary !border-warning !text-warning" : "btn-primary"}
              disabled={
                !finalPrompt || blockedOnMusic || phase === "starting" || phase === "polling"
              }
              onClick={() => void generate()}
            >
              {unmet.length > 0 ? "Generate anyway →" : "Generate ad →"}
            </button>
          </div>
          {!finalPrompt && (
            <p className="mt-2 text-xs text-muted">Compose the prompt first.</p>
          )}
          {finalPrompt && blockedOnMusic && (
            <p className="mt-2 text-xs text-warning">
              Compose the music bed in step 5 — the render is set to cut against it.
            </p>
          )}
        </Step>

        {(phase === "starting" || phase === "polling" || phase === "done" || phase === "mock" || phase === "failed") && (
          <div className="card overflow-hidden">
            <div className="mx-auto w-full max-w-md">
              <div className={`relative w-full bg-surface-2 ${ASPECT_CLASS[preset.aspect]}`}>
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
                      <p className="max-w-[80%] text-center text-danger">{error}</p>
                    ) : (
                      <>
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-muted/40 border-t-accent" />
                        <p>{phase === "starting" ? "Starting…" : "Rendering the ad — a few minutes…"}</p>
                      </>
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
