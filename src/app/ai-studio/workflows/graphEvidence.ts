import workflow from "../../../../public/studio/velune/workflows/VELUNE-Kontext-Workflow.json";
import api from "../../../../public/studio/velune/workflows/VELUNE-Kontext-API.json";
import { directions, media } from "./study";

type Preview = { label: string; src: string; alt: string };
type Evidence = {
  // Pixel bounds in the 1440px-wide capture. Use only the visible region
  // when one native node covers another.
  bounds: readonly [x: number, y: number, width: number, height: number];
  input: string;
  role: string;
  output: string;
  prompt?: string;
  previews?: readonly Preview[];
};
export type GraphNode = Evidence & { id: string; label: string; type: string };
type Edge = readonly [source: string, destination: string];
type CanvasEvidence = { nodes: readonly GraphNode[]; edges: readonly Edge[] };

const reference: Preview = {
  label: "Shared carton reference",
  src: `${media}/velune-raspberry-reference.png`,
  alt: "The original VELUNE Raspberry Ganache carton on a burgundy set",
};

function render(provider: "comfy" | "weave", direction: keyof typeof directions): Preview {
  const plate = directions[direction][provider];
  return { label: directions[direction].label, src: `${media}/${plate.file}.webp`, alt: plate.alt };
}

const comfyA = render("comfy", "premium");
const comfyB = render("comfy", "social");
const weaveA = render("weave", "premium");
const weaveB = render("weave", "social");
const premiumPrompt = api["9"].inputs.text;
const socialPrompt = api["10"].inputs.text;
const sampler = api["17"].inputs;
const comfySampling = `Seed ${sampler.seed}, ${sampler.steps} steps, CFG ${sampler.cfg}, ${sampler.sampler_name} sampler, ${sampler.scheduler} schedule, denoise ${sampler.denoise}.`;
const weaveSampling = "FLUX.1 Kontext Dev, fixed seed 26001117, 28 steps, guidance 2.5, match input, PNG.";

const comfyEvidence: Record<number, Evidence> = {
  1: { bounds: [133, 202, 162, 173], input: "velune-raspberry-reference.png, 896 × 1120.", role: "Load the chosen study reference once for both art directions.", output: "The original image tensor feeds the sizing node. The mask port is unused.", previews: [reference] },
  4: { bounds: [321, 220, 118, 80], input: "The loaded carton image.", role: "Resize the image to a resolution supported by Kontext.", output: "A resized image for VAE encoding." },
  5: { bounds: [306, 366, 118, 80], input: api["5"].inputs.vae_name, role: "Load the encoder and decoder that translate between pixels and the model’s latent space.", output: "A VAE shared by the reference encoder and both result decoders." },
  6: { bounds: [462, 260, 118, 79], input: "The resized carton image and the loaded FLUX VAE.", role: "Encode the carton in the model’s working representation.", output: "One reference latent shared by both conditioning branches and both samplers." },
  7: { bounds: [306, 478, 118, 88], input: `${api["7"].inputs.clip_name1} and ${api["7"].inputs.clip_name2}, with encoder type FLUX.`, role: "Load the text encoders used by both prompts.", output: "An encoder bundle for both CLIPTextEncode nodes." },
  8: { bounds: [466, 478, 117, 82], input: api["8"].inputs.unet_name, role: "Load the FLUX.1 Kontext Dev FP8 diffusion model.", output: "One model instance shared by the premium and social samplers." },
  9: { bounds: [610, 113, 146, 153], input: "The shared text encoders and the premium editorial prompt.", role: "Encode the instruction for soft amber light and a quiet wine-red set.", output: "Text conditioning for the premium branch.", prompt: premiumPrompt },
  10: { bounds: [610, 445, 146, 158], input: "The shared text encoders and the social campaign prompt.", role: "Encode the instruction for stronger diagonal light and a saturated raspberry set.", output: "Text conditioning for the social branch.", prompt: socialPrompt },
  11: { bounds: [758, 147, 116, 81], input: "Premium text conditioning and the encoded carton.", role: "Attach the carton latent as a visual reference for the premium edit.", output: "Premium conditioning with the carton reference attached." },
  12: { bounds: [758, 452, 116, 82], input: "Social text conditioning and the encoded carton.", role: "Attach the same carton latent to the social brief.", output: "Social conditioning with the carton reference attached." },
  13: { bounds: [886, 147, 119, 79], input: `Premium reference conditioning and guidance ${api["13"].inputs.guidance}.`, role: "Set the model’s embedded FLUX guidance for the premium edit.", output: "Positive conditioning for the premium sampler." },
  14: { bounds: [886, 453, 119, 81], input: `Social reference conditioning and guidance ${api["14"].inputs.guidance}.`, role: "Apply the same FLUX guidance to the social edit.", output: "Positive conditioning for the social sampler." },
  15: { bounds: [761, 259, 116, 80], input: "The encoded premium prompt.", role: "Zero out the conditioning for the sampler’s negative input.", output: "Neutral negative conditioning for the premium sampler." },
  16: { bounds: [761, 567, 116, 79], input: "The encoded social prompt.", role: "Zero out the conditioning for the sampler’s negative input.", output: "Neutral negative conditioning for the social sampler." },
  17: { bounds: [1014, 162, 117, 265], input: `Kontext, premium conditioning, neutral negative conditioning and the reference latent. ${comfySampling}`, role: "Generate the premium edit in latent space.", output: "A premium latent for the decoder. The saved image is available at the Save A node." },
  18: { bounds: [1014, 464, 117, 266], input: `Kontext, social conditioning, neutral negative conditioning and the reference latent. ${comfySampling}`, role: "Generate the social edit using the same sampling settings.", output: "A social latent for the decoder. The saved image is available at the Save B node." },
  19: { bounds: [1161, 161, 117, 81], input: "The premium sampler’s latent and the shared VAE.", role: "Decode the premium latent into pixels.", output: "A 944 × 1104 image for the premium save and preview nodes." },
  20: { bounds: [1161, 463, 117, 82], input: "The social sampler’s latent and the shared VAE.", role: "Decode the social latent into pixels.", output: "A 944 × 1104 image for the social save and preview nodes." },
  21: { bounds: [1282, 145, 118, 111], input: "The decoded premium image.", role: `Save the original candidate with prefix ${api["21"].inputs.filename_prefix}.`, output: "The original 944 × 1104 PNG with workflow and prompt metadata.", previews: [comfyA] },
  22: { bounds: [1282, 453, 118, 110], input: "The decoded social image.", role: `Save the original candidate with prefix ${api["22"].inputs.filename_prefix}.`, output: "The original 944 × 1104 PNG with workflow and prompt metadata.", previews: [comfyB] },
  23: { bounds: [1282, 256, 118, 145], input: "The same decoded image as Save A.", role: "Show the premium candidate in the native graph for review.", output: "A native preview of the premium image. The preview below uses its matching saved image.", previews: [comfyA] },
  24: { bounds: [1282, 563, 118, 145], input: "The same decoded image as Save B.", role: "Show the social candidate in the native graph for review.", output: "A native preview of the social image. The preview below uses its matching saved image.", previews: [comfyB] },
  25: { bounds: [19, 21, 216, 86], input: "The shared reference and the two direction briefs.", role: "Document the test: change lighting while holding the source and seed.", output: "A setup note on the canvas." },
  26: { bounds: [1288, 16, 152, 86], input: "The packaging checks for the two saved candidates.", role: "Record what the reviewer should check, including lettering, geometry and crop.", output: "A review note on the canvas." },
};

const comfy: CanvasEvidence = {
  nodes: workflow.nodes.map((node) => ({
    ...comfyEvidence[node.id],
    id: String(node.id),
    label: node.title ?? (node.id === 25 ? "Same product, two treatments" : "Review before use"),
    type: node.type,
  })),
  edges: workflow.links.map(([, source, , destination]) => [String(source), String(destination)]),
};

const weave: CanvasEvidence = {
  nodes: [
    { id: "source", label: "Shared input · Raspberry Ganache", type: "Import", bounds: [10, 132, 320, 451], input: "The same 896 × 1120 carton image used in ComfyUI.", role: "Import the reference once and connect it to both model nodes.", output: "An image input shared by the premium and social branches.", previews: [reference] },
    { id: "prompt-a", label: "A · Premium editorial", type: "Prompt", bounds: [366, 41, 321, 305], input: "The premium editorial brief used in both tools.", role: "Describe the warm, diffused key light and restrained editorial set.", output: "Prompt text for the premium Flux Kontext node.", prompt: premiumPrompt },
    { id: "prompt-b", label: "B · Social energy", type: "Prompt", bounds: [344, 362, 321, 305], input: "The social campaign brief used in both tools.", role: "Describe the saturated raspberry colour and diagonal light for portrait framing.", output: "Prompt text for the social Flux Kontext node.", prompt: socialPrompt },
    { id: "model-a", label: "A · Flux Kontext", type: "Flux Kontext Dev", bounds: [721, 6, 321, 391], input: `The shared carton and the premium prompt. ${weaveSampling}`, role: "Generate the premium editorial treatment.", output: "The original 896 × 1120 premium PNG, sent to input 1 of Compare.", previews: [weaveA] },
    { id: "model-b", label: "B · Flux Kontext", type: "Flux Kontext Dev", bounds: [721, 397, 321, 437], input: `The shared carton and the social prompt. ${weaveSampling}`, role: "Generate the social treatment with the same settings.", output: "The original 896 × 1120 social PNG, sent to input 2 of Compare.", previews: [weaveB] },
    { id: "compare", label: "Compare", type: "Compare · Slider", bounds: [1104, 166, 320, 453], input: "Both original Weave renders. Premium on input 1, social on input 2.", role: "Use a slider to inspect colour, lighting and package fidelity across both treatments.", output: "Both images remain available on separate ports. The creative selection and artwork restoration happen after this review.", previews: [weaveA, weaveB] },
  ],
  edges: [["source", "model-a"], ["source", "model-b"], ["prompt-a", "model-a"], ["prompt-b", "model-b"], ["model-a", "compare"], ["model-b", "compare"]],
};

export const graphEvidence = { comfy, weave };
