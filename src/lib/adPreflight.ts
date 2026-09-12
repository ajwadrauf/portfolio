/** One checklist definition for the playbook and the review attached to a take. */
export const PREFLIGHT_VERSION = "2026-09-10-v1";
export const PREFLIGHT_SAMPLE_FPS = 4;
export const PREFLIGHT_MAX_SECONDS = 60;

export const PREFLIGHT_GROUPS = [
  { group: "Before you generate", items: [
    { id: "approved_platform", title: "The platform is on the approved list for this kind of work", action: "Link the applicable approved-platform record and confirm the use case." },
    { id: "input_privacy", title: "Nothing confidential, personal, biometric or third-party-licensed is going into the prompt or the references", action: "Review every original input and confirm the system was authorized to process it." },
    { id: "source_rights", title: "Source assets are ours, or the rights to process them are confirmed in writing", action: "Attach ownership or written AI-processing rights for the source assets." },
    { id: "talent_consent", title: "If a real person appears, consent and usage rights exist and are documented", action: "Identify applicable talent releases, or document why no real-person consent is required." },
  ] },
  { group: "If a real product is shown", items: [
    { id: "authentic_capture", title: "The product in frame originates from authentic capture of the actual item", action: "Compare against the authentic capture and record its source asset ID." },
    { id: "no_substitution", title: "AI work is confined to the surroundings: no synthetic substitution of the product", action: "Check source capture and production history; visual similarity alone does not prove provenance." },
    { id: "product_truth", title: "Nothing has been added, enlarged, improved or made more appetising than the real thing", action: "Compare the actual product and portion with every relevant shot, including fillings and texture." },
    { id: "source_traceability", title: "The authentic source file is filed and traceable to this final asset", action: "Record the source location and link it to this exact delivered take." },
  ] },
  { group: "If a person appears", items: [
    { id: "original_talent", title: "Synthetic talent is original and not a recognisable individual", action: "Review identity development and permissions; do not infer originality from appearance." },
    { id: "truthful_role", title: "Not presented as a customer, employee, expert or regulated professional unless true and documented", action: "Verify the depicted role and any implied authority against written evidence." },
    { id: "no_testimonial", title: "No manufactured testimonial, endorsement or before-and-after", action: "Check the full impression, script and any claimed experience or endorsement." },
    { id: "talent_channel", title: "Broadcast or OLV on-camera synthetic talent has specific approval", action: "Record the intended channel and any specific on-camera synthetic-talent approval." },
    { id: "voice_rights", title: "Any voice is original synthetic, non-impersonative, and rights-cleared", action: "Record the voice source, commercial-use licence and any relevant consent." },
  ] },
  { group: "Before it ships", items: [
    { id: "overall_impression", title: "Both tests answered: fidelity, and the catch-all", action: "A named reviewer must answer both consumer-impression tests against the complete ad." },
    { id: "food_children", title: "Child-directed and food-advertising requirements checked, unchanged by AI being involved", action: "Confirm audience, market and applicable requirements with the responsible reviewer." },
    { id: "internal_disclosure", title: "Material AI use is disclosed internally in the approval workflow", action: "Attach the internal AI-use disclosure and approval record." },
    { id: "external_disclosure", title: "External disclosure decided against channel, platform and regulatory requirements", action: "Record the disclosure decision for the intended channel and market." },
    { id: "provenance_record", title: "The provenance record is complete: platform, component, source, rights, consent, exceptions", action: "Complete the record with source IDs, rights, consent and any approved exceptions." },
    { id: "human_approval", title: "A named human has approved it", action: "Record the accountable person's decision, name, date and evidence after reviewing the complete asset." },
  ] },
] as const;

export const PLAYBOOK_CHECKLIST = PREFLIGHT_GROUPS.map(({ group, items }) => ({ group, items: items.map((item) => item.title) }));
export const AI_PREFLIGHT_CHECKS = [
  { id: "visual_product", title: "Product and packaging consistency", action: "Compare flagged moments with the approved product reference." },
  { id: "visible_text", title: "Visible text, labels and prices", action: "Proofread at full resolution against the approved wording and price source." },
  { id: "claims_impression", title: "Claims and overall consumer impression", action: "Review any stated or implied promise against its supporting evidence." },
  { id: "people_portrayal", title: "People, authority and endorsements", action: "Review depicted roles and any implied testimonial or endorsement." },
  { id: "picture_integrity", title: "Motion, continuity and framing", action: "Inspect the flagged transition or object at full speed and frame by frame." },
  { id: "embedded_audio", title: "Embedded speech, music and effects", action: "Listen to the actual MP4, then review the final mix again after adding separate stems." },
] as const;

export type GenerationSnapshot = {
  submittedAt: string;
  prompt: string;
  negativePrompt?: string;
  modelId: string;
  durationSeconds: number;
  aspect: string;
  resolution?: string;
  audioMode?: string;
  references: { name: string; media: string; role: string }[];
};
export type CompletedPreflightTake = { id: string; videoUrl: string; context: GenerationSnapshot | null };
export type PreflightDeclarations = { productKind: "unknown" | "real" | "fictional"; channel: "unknown" | "portfolio" | "social" | "olv" | "broadcast" };
export type PreflightMetadata = { durationSeconds: number; width: number; height: number };
export type PreflightReferenceImage = { name: string; role: string; dataUrl: string };
export type PreflightRequest = {
  requestId: string;
  videoUrl: string;
  context: GenerationSnapshot | null;
  metadata: PreflightMetadata;
  declarations: PreflightDeclarations;
  referenceImages?: PreflightReferenceImage[];
};
export type PreflightStatus = "pass" | "flag" | "unverified" | "not_applicable";
export type PreflightFinding = {
  id: string; group: string; title: string; status: PreflightStatus;
  basis: "ai" | "human_required" | "metadata";
  evidence: string; action: string; timestamps: number[];
};
export type PreflightReport = {
  id: string; assetKey: string; videoUrl: string; createdAt: string; model: string;
  checklistVersion: string; summary: string;
  overall: "issues_found" | "human_review_required";
  declarations: PreflightDeclarations;
  coverage: { mode: "native_video"; sampleFps: number; durationSeconds: number; referenceImages: number; audio: "embedded_only"; limitations: string[] };
  checks: PreflightFinding[];
  usage?: { inputTokens: number; outputTokens: number; thoughtTokens: number };
  estimatedCostUsd: number;
};

/** Planning estimate, not an invoice. Standard Gemini 2.5 Flash rates. */
export function estimatePreflightCost(seconds: number, imageCount = 0): number {
  const videoAndText = Math.min(PREFLIGHT_MAX_SECONDS, Math.max(0, seconds)) * PREFLIGHT_SAMPLE_FPS * 258 + 2500 + imageCount * 1290;
  const audio = Math.min(PREFLIGHT_MAX_SECONDS, Math.max(0, seconds)) * 32;
  return Math.ceil((videoAndText * .3 / 1e6 + audio / 1e6 + 8000 * 2.5 / 1e6) * 1000) / 1000;
}

/** Build the complete checklist ourselves; model output never defines policy. */
export function normalizePreflightChecks(raw: unknown, request: PreflightRequest): PreflightFinding[] {
  const rows = Array.isArray(raw) ? raw : [];
  const byId = new Map<string, Record<string, unknown>>();
  const duplicates = new Set<string>();
  for (const value of rows) {
    if (!value || typeof value !== "object" || typeof value.id !== "string") continue;
    if (byId.has(value.id)) duplicates.add(value.id);
    byId.set(value.id, value);
  }
  const clean = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";
  function observation(id: string) {
    const row = duplicates.has(id) ? undefined : byId.get(id);
    const status = row?.status;
    const evidence = clean(row?.evidence, 1200);
    const valid = Boolean(evidence && ["pass", "flag", "unverified", "not_applicable"].includes(String(status)));
    return {
      status: valid ? status as PreflightStatus : "unverified" as const,
      evidence: valid ? evidence : "The AI did not return a usable observation for this check.",
      action: clean(row?.action, 500),
      timestamps: Array.isArray(row?.timestamps) ? [...new Set(row.timestamps.filter((n): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n < request.metadata.durationSeconds))].slice(0, 5) : [],
    };
  }
  const checks: PreflightFinding[] = AI_PREFLIGHT_CHECKS.map((check) => {
    const result = observation(check.id);
    if (check.id === "visual_product" && !request.referenceImages?.some((r) => r.role === "product")) {
      // Style, motion and texture references cannot establish product identity.
      if (result.status !== "flag") result.status = "unverified";
      result.evidence = "No original product-reference image was included in this review. " + result.evidence;
    }
    return { ...check, group: "Picture & sound · AI observations", ...result, action: result.action || check.action, basis: "ai" };
  });
  for (const group of PREFLIGHT_GROUPS) {
    for (const check of group.items) {
      const result = observation(check.id);
      const fictionalProduct = group.group === "If a real product is shown" && request.declarations.productKind === "fictional";
      checks.push({
        ...check, group: group.group,
        status: result.status === "flag" ? "flag" : fictionalProduct ? "not_applicable" : "unverified",
        basis: fictionalProduct && result.status !== "flag" ? "metadata" : "human_required",
        evidence: result.status === "flag" ? `AI flagged a possible concern; human evidence is still required. ${result.evidence}`
          : fictionalProduct ? "You declared this a fictional concept. This real-product requirement is marked not applicable on that declaration, not verified by AI. Reassess before using it to advertise a real item."
          : "The video cannot establish this requirement. Documentary evidence or a responsible human decision is still needed.",
        action: check.action,
        timestamps: result.status === "flag" ? result.timestamps : [],
      });
    }
  }
  const context = request.context;
  const targetAspect = context?.aspect.split(":").map(Number);
  const ratio = targetAspect?.length === 2 ? targetAspect[0] / targetAspect[1] : NaN;
  const wrongDuration = Boolean(context && Math.abs(context.durationSeconds - request.metadata.durationSeconds) > .25);
  const wrongAspect = Number.isFinite(ratio) && Math.abs(request.metadata.width / request.metadata.height - ratio) > .035;
  checks.unshift({
    id: "delivery_metadata", group: "Picture & sound · AI observations", title: "Duration and aspect ratio", basis: "metadata",
    status: !context ? "unverified" : wrongDuration || wrongAspect ? "flag" : "pass",
    evidence: `The browser measured ${request.metadata.width} × ${request.metadata.height}, ${request.metadata.durationSeconds.toFixed(2)} seconds. ${!context ? "The original delivery brief is unavailable, so compliance with it cannot be checked." : `The submitted brief requested ${context.durationSeconds} seconds at ${context.aspect}.`}`,
    action: !context ? "Recover the original delivery specification before clearing this item." : wrongDuration || wrongAspect ? "Check the export against the intended duration and shape." : "Confirm final codec, loudness and platform delivery specifications separately.", timestamps: [],
  });
  return checks;
}

export function preflightSummary(checks: PreflightFinding[]): string {
  const flags = checks.filter((c) => c.status === "flag").length;
  const needs = checks.filter((c) => c.status === "unverified").length;
  return `${flags ? `${flags} concern${flags === 1 ? "" : "s"} flagged` : "No concerns flagged in the inspected material"}; ${needs} check${needs === 1 ? "" : "s"} still need evidence or review. A human publishing decision is required.`;
}
