export const media = "/studio/velune/workflows";
export const weaveUrl = "https://app.weavy.ai/flow/jlcweqtW4MeH6D4ZDHvIw3";

type Plate = {
  file: string;
  label: string;
  alt: string;
  size: string;
};

export const directions = {
  premium: {
    label: "Premium editorial",
    brief: "A warm key light, a quiet wine-red set and room for a headline.",
    comparison: "ComfyUI gave the scene an amber falloff and a grounded carton. Weave made an even, legible packshot, but the light had less direction. Both needed the packaging checked.",
    decision: "I chose the ComfyUI set. I mapped the reference face back onto the carton, preserving the generated silhouette, side and tabletop shadow. The flavour name, printed chocolate and paper texture come from the source face.",
    comfy: { file: "comfy-premium", label: "ComfyUI", size: "944 × 1104", alt: "ComfyUI premium carton with warm amber falloff and a dark tabletop" },
    weave: { file: "weave-premium", label: "Figma Weave", size: "896 × 1120", alt: "Weave premium carton against an even, deep burgundy studio background" },
    finished: { file: "finished-premium", label: "Source face restored", size: "944 × 1104", alt: "Finished premium composition with reference chocolate artwork and lettering mapped to the carton face" },
    selected: "comfy",
  },
  social: {
    label: "Social campaign",
    brief: "A brighter raspberry set with diagonal light, designed around a portrait frame.",
    comparison: "ComfyUI produced a softer sweep and kept the box more upright. Weave brought more momentum with repeated light bands, but tipped the carton and left a busier field for copy.",
    decision: "I chose the Weave treatment for its stronger rhythm and restored the source face. The light bands stay in the plate. A final social layout would still need separately typeset copy, safe-area checks and a crop review.",
    comfy: { file: "comfy-social", label: "ComfyUI", size: "944 × 1104", alt: "ComfyUI social carton on a red set with a smooth diagonal sweep of light" },
    weave: { file: "weave-social", label: "Figma Weave", size: "896 × 1120", alt: "Weave social carton tilted slightly against saturated raspberry light bands" },
    finished: { file: "finished-social", label: "Source face restored", size: "896 × 1120", alt: "Finished social composition with the source carton face restored against red diagonal lighting" },
    selected: "weave",
  },
} as const satisfies Record<string, { label: string; brief: string; comparison: string; decision: string; comfy: Plate; weave: Plate; finished: Plate; selected: "comfy" | "weave" }>;

export const graphs = {
  comfy: {
    label: "ComfyUI",
    run: "1 cloud run · 2 saved PNGs",
    image: "comfy-graph.webp",
    height: 744,
    alt: "Executed ComfyUI canvas with a shared reference feeding two sampler branches and their saved image previews",
  },
  weave: {
    label: "Figma Weave",
    run: "2 model runs · 6 trial credits",
    image: "weave-graph.webp",
    height: 834,
    alt: "Native Figma Weave canvas with one product image, two prompt nodes, two generated carton images and the Compare node",
  },
} as const;
