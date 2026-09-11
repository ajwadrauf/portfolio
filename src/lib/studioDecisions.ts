import { H3_MODEL_ID } from "./h3Video";
import { audioCapability, DISCRETE_DURATIONS, maxAdSeconds, minAdSeconds, referenceCeilingsFor, MULTI_REF_MODELS } from "./adPresets";
import { estimateCost, MODELS, type ModelInfo } from "./models";
import { aspectsFor, resolutionsFor, type VideoResolution } from "./videoCost";
import { PACKSHOT_MODELS } from "./packshot";
import { DELIVERABLES } from "./deliverables";

export type ModelScenario = { seconds: number; aspect: string; resolution: VideoResolution; referenceImages: number; inputVideoSeconds: number; characters: number; requireAudio: boolean; imageTier: number };
export const DEFAULT_MODEL_SCENARIO: ModelScenario = { seconds: 8, aspect: "9:16", resolution: "480p", referenceImages: 1, inputVideoSeconds: 0, characters: 140, requireAudio: false, imageTier: 0 };
export function scenarioForModel(model: ModelInfo, scenario: ModelScenario) {
  const reasons: string[] = [];
  const numbers = [scenario.seconds, scenario.referenceImages, scenario.inputVideoSeconds, scenario.characters, scenario.imageTier];
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return { compatible: false, reasons: ["Enter valid non-negative values."], cost: 0, basis: "Invalid scenario" };
  if (![scenario.referenceImages, scenario.characters, scenario.imageTier].every(Number.isInteger)) return { compatible: false, reasons: ["Reference counts, characters and tiers must be whole numbers."], cost: 0, basis: "Invalid scenario" };
  let basis = "";
  let sizePresetId: string | undefined;
  if (model.kind === "video") {
    if (scenario.seconds < minAdSeconds(model.id) || scenario.seconds > maxAdSeconds(model.id)) reasons.push(`This app offers ${minAdSeconds(model.id)}–${maxAdSeconds(model.id)} seconds for this route.`);
    if (DISCRETE_DURATIONS[model.id] && !DISCRETE_DURATIONS[model.id].includes(scenario.seconds)) reasons.push(`Choose ${DISCRETE_DURATIONS[model.id].join(" or ")} seconds.`);
    if (!aspectsFor(model.id).some((a) => a.id === scenario.aspect)) reasons.push("This aspect ratio is not offered for this route.");
    if ((model.id.startsWith("seedance") || model.id === H3_MODEL_ID) && !resolutionsFor(model.id).includes(scenario.resolution)) reasons.push("This resolution is not available on the reference route.");
    if (scenario.inputVideoSeconds > 0 && !MULTI_REF_MODELS.includes(model.id)) reasons.push("Motion-guide input is not implemented for this route.");
    if (model.id === H3_MODEL_ID && (scenario.inputVideoSeconds > 15 || (scenario.inputVideoSeconds > 0 && scenario.inputVideoSeconds < 2))) reasons.push("H3 Max motion references need 2–15 seconds combined; each clip also needs 2–15 seconds.");
    if (model.id === H3_MODEL_ID && scenario.referenceImages + (scenario.inputVideoSeconds > 0 ? 1 : 0) > 12) reasons.push("H3 Max accepts 12 combined reference files.");
    if (model.id === H3_MODEL_ID && scenario.referenceImages === 0 && scenario.inputVideoSeconds === 0) reasons.push("H3 Max Reference needs visual input.");
    if (scenario.inputVideoSeconds > 30) reasons.push("This app limits combined motion guides to 30 seconds.");
    if (scenario.referenceImages > (MULTI_REF_MODELS.includes(model.id) ? referenceCeilingsFor(model.id).image : 1)) reasons.push("This route does not take this many appearance references.");
    if (scenario.requireAudio && !audioCapability(model.id).native) reasons.push("Native audio is not implemented for this route.");
    basis = model.id === H3_MODEL_ID ? `${scenario.seconds}s · ${scenario.resolution} · output + reference inputs; assumes 1024×1024 per image; 1080p input rate estimated from 768p` : model.id.startsWith("seedance") ? `${scenario.seconds}s · ${scenario.resolution} · ${scenario.aspect} · ${scenario.inputVideoSeconds}s video input` : `${scenario.seconds}s · configured per-second rate; resolution is endpoint-controlled here`;
  } else if (model.kind === "image") {
    if (!PACKSHOT_MODELS.includes(model.id) && !DELIVERABLES.some((d) => d.kind === "still" && d.modelOptions.includes(model.id))) reasons.push("Listed for comparison only; this model has no generation route in the current studio.");
    if (scenario.referenceImages > (model.maxReferenceImages ?? 1)) reasons.push(`Configured reference limit: ${model.maxReferenceImages ?? 1}.`);
    const presets = model.outputSizes?.presets;
    const preset = presets?.[Math.min(scenario.imageTier, presets.length - 1)];
    sizePresetId = preset?.id;
    basis = `1 output · ${preset?.label ?? "endpoint default size"} · ${scenario.referenceImages} references`;
  } else if (model.kind === "voice") { basis = `${scenario.characters} characters · separate voice file`; if (scenario.characters < 1 || scenario.characters > 1200) reasons.push("This app accepts 1–1,200 spoken characters per voice request."); }
  else if (model.kind === "music") { basis = `${scenario.seconds}s requested · billed per started minute`; if (scenario.seconds < 3 || scenario.seconds > 600) reasons.push("Music requests need 3–600 seconds."); }
  else { basis = `${scenario.seconds}s · separate effect file`; if (scenario.seconds < .5 || scenario.seconds > 22) reasons.push("Effects need 0.5–22 seconds."); }
  const cost = estimateCost(model.id, { seconds: scenario.seconds, aspect: scenario.aspect, resolution: scenario.resolution, hasVideoInputs: scenario.inputVideoSeconds > 0, inputVideoSeconds: scenario.inputVideoSeconds, referenceImages: scenario.referenceImages, characters: scenario.characters, sizePresetId });
  return { compatible: reasons.length === 0, reasons, cost, basis };
}
export function modelSource(model: ModelInfo) {
  return model.provider === "gemini" ? "https://ai.google.dev/gemini-api/docs/pricing" : model.provider === "recraft" ? "https://www.recraft.ai/docs" : `https://fal.ai/models/${model.endpoint}`;
}

export type ProductionScenario = { accepted: number; attempts: number; reviewMinutes: number; hourlyRate: number; seats: number; monthlySeat: number; suiteRender: number; apiRender: number; maintenanceHours: number; setupCost: number; amortizationMonths: number };
export const DEFAULT_PRODUCTION_SCENARIO: ProductionScenario = { accepted: 100, attempts: 2, reviewMinutes: 4, hourlyRate: 60, seats: 3, monthlySeat: 30, suiteRender: 1, apiRender: .8, maintenanceHours: 4, setupCost: 2400, amortizationMonths: 12 };
export function productionComparison(s: ProductionScenario) {
  if (!s || Object.keys(DEFAULT_PRODUCTION_SCENARIO).some((key) => !Number.isFinite(s[key as keyof ProductionScenario]) || s[key as keyof ProductionScenario] < 0) || s.accepted < 1 || s.attempts < 1 || s.amortizationMonths < 1) throw new Error("Use positive outputs, at least one attempt, and at least one amortization month.");
  const renders = s.accepted * s.attempts;
  const review = renders * s.reviewMinutes / 60 * s.hourlyRate;
  const suiteFixed = s.seats * s.monthlySeat;
  const apiFixed = s.maintenanceHours * s.hourlyRate + s.setupCost / s.amortizationMonths;
  const suite = suiteFixed + renders * s.suiteRender + review;
  const api = apiFixed + renders * s.apiRender + review;
  const savingPerAsset = s.attempts * (s.suiteRender - s.apiRender);
  const breakEven = savingPerAsset > 0 && apiFixed > suiteFixed ? Math.ceil((apiFixed - suiteFixed) / savingPerAsset) : null;
  return { renders, review, suite, api, suitePerAsset: suite / s.accepted, apiPerAsset: api / s.accepted, breakEven, cheaper: suite <= api ? "suite" as const : "api" as const };
}

export function modelsForKind(kind: ModelInfo["kind"]) { return Object.values(MODELS).filter((m) => m.kind === kind); }
