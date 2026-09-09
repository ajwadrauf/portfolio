/** Upload order, intent and excerpts from the consolidated 18-second brief. */
export const CREAM_REFERENCES = [
  {
    id: "packaging", number: 1, title: "The product identity", short: "Packaging",
    alt: "BRANDNAME vanilla, chocolate and strawberry tubs on dark stone",
    role: "Ivory, cocoa and dusty rose. One packaging reference gives the three flavours a consistent family of labels and a matte paper finish.",
    shots: "Spoon lift · Runway · Overhead · Hero landing",
    cue: 15, cueLabel: "Hero landing · 15s",
    boundary: "The Blender guide supplies the tub shapes and positions. The photograph supplies the artwork, mapped by flavour. The same image is reused wherever a tub appears.",
    prompt: "[Image1] = the single packaging reference, reused for packaging artwork and paper material whenever tubs are visible in any shot. There is no second packaging reference. Preserve the video tub shapes and staging; map artwork by flavour, not photograph position. Printed scoops stay printed on the label.",
  },
  {
    id: "macro", number: 2, title: "The detail you can almost taste", short: "Macro",
    alt: "Close-up of ivory vanilla ice cream with fine seeds, scoop ridges and soft folds",
    role: "Fine vanilla seeds, irregular air pockets and soft ivory folds establish the food texture before the camera reveals the product.",
    shots: "Macro · 0–2s", cue: 0, cueLabel: "Macro · 0s",
    boundary: "The reference describes the surface. The guide supplies the moving camera and broad geometry, so the result should reveal depth as the camera travels.",
    prompt: "0–2 seconds: 35-degree continuous macro arc across vanilla ridges. Broad geometry and travel come from the video, fine material from [Image2]. Keep the moving focal region legible.",
  },
  {
    id: "spoon", number: 3, title: "A moment of resistance", short: "Spoon lift",
    alt: "Vanilla scoop lifted on a stainless steel spoon with a short cream connection below",
    role: "The spoon finish, dense scoop texture and a brief cream connection suggest the weight and adhesion of the lift.",
    shots: "Spoon lift · 2–5s", cue: 2, cueLabel: "Spoon lift · 2s",
    boundary: "The still is a moment during release. The prompt asks the cream to thin and separate, while preserving the guide’s tub, lift and camera route.",
    prompt: "2–5 seconds: one spoon lifts one vanilla scoop from one open vanilla tub. Use [Image1] for the tub packaging and [Image3] for spoon/cream appearance. Locally reconstruct adhesion and the contact groove. A short cream neck beside the spoon edge thins, separates and recoils by approximately 3.8–4.0 seconds in the full edit. Permit earlier local separation if needed to prevent a long rubbery string.",
  },
  {
    id: "spiral", number: 4, title: "Give the cream a gesture", short: "Cream spiral",
    alt: "A thick satin vanilla cream ribbon spiralling around a suspended vanilla scoop",
    role: "A thick ribbon with rounded edges and a satin sheen gives the orbit a sculptural centrepiece.",
    shots: "Cream spiral · 5–7.5s", cue: 5, cueLabel: "Cream spiral · 5s",
    boundary: "The guide determines how the ribbon grows and where it crosses the scoop. The still contributes its material and thickness, without adding extra turns.",
    prompt: "5–7.5 seconds: one ribbon curls around one suspended vanilla scoop during an ascending 92-degree camera orbit and small bank. Follow the guide's evolving envelope, with viscous local deformation and soft tapering. Do not add spiral turns from [Image4].",
  },
  {
    id: "trio", number: 5, title: "Three flavours, one visual language", short: "Flavour trio",
    alt: "Floating vanilla, chocolate and strawberry scoops with chocolate pieces and strawberries",
    role: "Distinct scoop colours and ingredient textures make the three flavours readable as the camera moves around them.",
    shots: "Flavour burst · 7.5–10s / Overhead · 12.5–15s", cue: 7.5, cueLabel: "Flavour burst · 7.5s",
    boundary: "The orbit uses the scoop and ingredient materials. The overhead uses only the filling textures inside the tubs, so floating fruit should not carry into that shot.",
    prompt: "[Image5] = three scoop colours/textures and ingredient materials. For the floating scene use the video ingredient sizes, counts and paths. For the overhead use only the flavour textures on the fillings already inside the tubs; do not introduce floating scoops or fruit there.",
  },
] as const;

export const CREAM_REFERENCE_RULE = "Reference priority: [Video1] determines the camera path, lens perspective, shot framing, object count, placement, scale, major trajectories and timing. Image references determine only the appearance or local material behaviour assigned below. They are not first-frame targets. Do not replace the moving shot with a pan or zoom over a still image. Render new viewpoints and coherent parallax as the camera travels.";
