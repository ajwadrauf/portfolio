/**
 * The finishing operations, without the server-only client.
 *
 * `lib/recraft.ts` imports "server-only" because it holds the API token, so
 * the browser cannot read the op table from there. The costs and the reasoning
 * are content the UI has to render, so they live here and the server module
 * re-uses them — one definition, not two that drift.
 */
export const FINISH_OPS = {
  cutout: {
    id: "cutout" as const,
    path: "/images/removeBackground",
    label: "Remove background",
    cost: 0.01,
    why: "A packshot on white is a picture of a product. One with the background actually removed is an asset — it drops onto a shelf render, a coloured tile or a banner with no halo and no hand re-cut. That re-cut is the step that decides whether a generated angle is usable downstream or only viewable, and it costs a cent against the render's twenty-one.",
    minEdge: 256,
  },
  upscale: {
    id: "upscale" as const,
    path: "/images/crispUpscale",
    label: "Crisp upscale",
    cost: 0.004,
    why: "Resolution is where the money is, so the cheap route is to generate small and upscale after: a 1K render plus a $0.004 upscale lands near a 2K render costing six times as much. The better reason is that upscaling keeps the image — regenerating at a higher tier re-rolls it, so you get a different composition and have to approve the angle all over again.",
    minEdge: 32,
  },
} as const;

export type FinishOp = keyof typeof FINISH_OPS;
