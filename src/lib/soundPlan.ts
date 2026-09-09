import { z } from "zod";

export const VOICE_MODEL_ID = "eleven-voice";
export const VOICES = ["Rachel", "Aria", "Roger", "Sarah", "George"] as const;
export const cueSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().trim().min(1).max(80),
  seconds: z.number().min(3).max(30),
  line: z.string().max(1200), music: z.string().max(400),
});
export const soundPlanSchema = z.object({
  title: z.string().max(120), bpm: z.number().min(40).max(200),
  narration: z.enum(["external", "native", "none"]),
  scenes: z.array(cueSchema).min(1).max(10),
});
export type SoundPlan = z.infer<typeof soundPlanSchema>;
export type SceneCue = z.infer<typeof cueSchema>;
export const compositionSchema = z.object({
  positive_global_styles: z.array(z.string().max(2000)).min(1).max(20),
  negative_global_styles: z.array(z.string().max(200)).max(20),
  sections: z.array(z.object({
    section_name: z.string().min(1).max(100), duration_ms: z.number().int().min(3000).max(120000),
    positive_local_styles: z.array(z.string().max(400)).max(20),
    negative_local_styles: z.array(z.string().max(200)).max(20),
    lines: z.array(z.string().max(200)).max(0), // Score only: narration never becomes lyrics.
  })).min(1).max(10),
});
export type CompositionPlan = z.infer<typeof compositionSchema>;

export function soundTemplate(id: "narrated" | "rhythm" | "cream"): SoundPlan {
  if (id === "cream") return {
    title: "Cream in motion · 18s", bpm: 96, narration: "external",
    scenes: [
      { id: "texture", title: "Macro & spoon", seconds: 5, line: "Take a little pause.", music: "Soft felt piano opening; intimate, sparse; leave the spoon lift audible." },
      { id: "trio", title: "Spiral & flavours", seconds: 5, line: "Vanilla. Chocolate. Strawberry. Find your favourite.", music: "Warm pad enters; glassy accents lift gently into the three-flavour reveal." },
      { id: "angles", title: "Runway & overhead", seconds: 5, line: "A little joy, from every angle.", music: "A light brushed pulse supports the lateral track and overhead move." },
      { id: "pack", title: "Product hold", seconds: 3, line: "Make this moment yours.", music: "Soft resolved chord at the product reveal; decay to the end." },
    ],
  };
  const scenes: SceneCue[] = [
    { id: "hook", title: "Hook", seconds: 4, line: "Some moments deserve a little more.", music: "One memorable opening motif, soft and sparse under the voice." },
    { id: "reveal", title: "Reveal", seconds: 6, line: "A closer look. A different way to enjoy the everyday.", music: "Introduce warm bass and a restrained pulse at the reveal." },
    { id: "detail", title: "Detail", seconds: 8, line: "From the first detail to the finishing touch, let the product do the talking.", music: "Keep a steady groove with space around narration and product sounds." },
    { id: "payoff", title: "Payoff", seconds: 8, line: "Made for the moments you choose to make your own.", music: "Lift with harmony and texture, without masking the voice." },
    { id: "close", title: "Brand & CTA", seconds: 4, line: "Discover your next favourite.", music: "Clean final accent at the pack reveal, then a resolved tail." },
  ];
  if (id === "rhythm") scenes.forEach((s) => { s.line = ""; });
  return { title: id === "rhythm" ? "Product rhythm · 30s" : "Narrated product story · 30s", bpm: 120, narration: id === "rhythm" ? "none" : "external", scenes };
}

export const planSeconds = (plan: SoundPlan) => Math.round(plan.scenes.reduce((n, s) => n + s.seconds, 0) * 1000) / 1000;
export const wordCount = (text: string) => text.replace(/\[[^\]]*\]/g, "").trim().split(/\s+/).filter(Boolean).length;
/** A planning heuristic, not a TTS duration promise. */
export const estimatedReadSeconds = (text: string) => wordCount(text) * 60 / 140;
export function timedCues(plan: SoundPlan) {
  let start = 0;
  return plan.scenes.map((cue) => { const row = { ...cue, start, end: start + cue.seconds }; start += cue.seconds; return row; });
}
export function planProblem(plan: SoundPlan | null, duration: number, nativeAvailable: boolean, silent: boolean) {
  if (!plan) return null;
  if (!soundPlanSchema.safeParse(plan).success) return "Give each sound section a name and at least 3 seconds, with a tempo from 40–200 BPM.";
  if (Math.abs(planSeconds(plan) - duration) > 0.01) return `Sound plan is ${planSeconds(plan)}s; video is ${duration}s. Match the lengths before generating.`;
  if (plan.narration === "native" && (!nativeAvailable || silent)) return "Native narration needs a model with sound and Native or Layered sound selected. Or choose a separate ElevenLabs voice.";
  return null;
}
export function buildComposition(plan: SoundPlan, style: string): CompositionPlan {
  return {
    positive_global_styles: [style || "Premium commercial score", `${plan.bpm} BPM, 4/4 time`, "instrumental", "cohesive transitions between sections"],
    negative_global_styles: ["vocals", "singing", "spoken words", "lyrics"],
    sections: plan.scenes.map((s) => ({
      section_name: s.title, duration_ms: Math.round(s.seconds * 1000), lines: [],
      positive_local_styles: [s.music || "Continue the established arrangement", ...(s.line && plan.narration !== "none" ? ["Sparse arrangement beneath a separately recorded narrator; leave room for speech"] : [])],
      negative_local_styles: ["vocals", "singing", "speech"],
    })),
  };
}
export function planVideoDirection(plan: SoundPlan | null): string {
  if (!plan) return "";
  const cues = timedCues(plan).map((s) => `${s.start.toFixed(1)}–${s.end.toFixed(1)}s (${s.title}): ${plan.narration === "native" && s.line.trim() ? `Off-screen narrator says: ${JSON.stringify(s.line.trim())}.` : "Leave space for the planned soundtrack."}`).join("\n");
  const instruction = plan.narration === "native"
    ? "Use one consistent off-screen narrator. Speak only the quoted lines in their intended windows; no invented speech, presenter or lip-sync."
    : "Do not generate speech, dialogue, narration, singing or lip-sync. Narration, if planned, is a separate voice recording for the final edit.";
  return `\n\n[Sound cue sheet]\nThis cue sheet takes precedence over earlier narration instructions only. Preserve the supplied visual direction and Blender edit; these are audio windows, not new camera instructions. ${instruction}\n${cues}`;
}
export function cueSheet(plan: SoundPlan) {
  return `# ${plan.title}\n\n${planSeconds(plan)} seconds · ${plan.bpm} BPM · narration: ${plan.narration}\n\n${timedCues(plan).map((s) => `## ${s.start.toFixed(1)}–${s.end.toFixed(1)}s · ${s.title}\nVoice: ${plan.narration === "none" ? "None" : s.line || "Leave room for product sound"}\nMusic: ${s.music}\n`).join("\n")}\nPlan → audition voice → confirm picture timing → compose score → mix in editor.\nPlace each voice clip at its cue start; TTS files do not contain timeline silence. Measure actual speech and allow breaths before locking picture.\nThis is a planning template, not an analysis of an uploaded film. Verify its cue boundaries against the actual Blender or video edit.\n`;
}
