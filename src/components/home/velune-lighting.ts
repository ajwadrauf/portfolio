import type { Flavour } from "./velune-layouts";

export const productLighting = {
  left: {
    label: "Left softbox", shortLabel: "Left",
    direction: [-0.66, -0.39, 0.64], key: 1, ambient: 0.29, falloff: 0.44,
    shadowOffset: 0.34, shadowWidth: 0.76, shadowDepth: 0.16,
  },
  right: {
    label: "Right softbox", shortLabel: "Right",
    direction: [0.66, -0.39, 0.64], key: 1, ambient: 0.29, falloff: 0.44,
    shadowOffset: -0.34, shadowWidth: 0.76, shadowDepth: 0.16,
  },
  overhead: {
    label: "Overhead", shortLabel: "Top",
    direction: [0, -0.88, 0.48], key: 1.04, ambient: 0.28, falloff: 0.66,
    shadowOffset: 0, shadowWidth: 0.6, shadowDepth: 0.11,
  },
} as const;

export type Lighting = keyof typeof productLighting;

// Fold positions are normalized within the original carton cutouts.
const cartonFaces = {
  raspberry: { side: 1, seamTop: 0.903, seamBottom: 0.904, sourceSideExposure: 0.33 },
  pistachio: { side: -1, seamTop: 0.113, seamBottom: 0.116, sourceSideExposure: 0.34 },
  caramel: { side: 1, seamTop: 0.894, seamBottom: 0.896, sourceSideExposure: 0.36 },
} as const;

const linear = Float32Array.from({ length: 256 }, (_, channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

const encoded = Uint8ClampedArray.from({ length: 4096 }, (_, channel) => {
  const value = channel / 4095;
  return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
});

const preparedCartons = new WeakMap<HTMLImageElement, Map<Lighting, HTMLCanvasElement>>();

export function lightCarton(carton: HTMLImageElement, flavour: Flavour, lighting: Lighting): HTMLCanvasElement | HTMLImageElement {
  const versions = preparedCartons.get(carton) ?? new Map<Lighting, HTMLCanvasElement>();
  const saved = versions.get(lighting);
  if (saved) return saved;

  const layer = document.createElement("canvas");
  const width = carton.naturalWidth;
  const height = carton.naturalHeight;
  layer.width = width;
  layer.height = height;
  const ctx = layer.getContext("2d", { willReadFrequently: true });
  if (!ctx) return carton;

  ctx.drawImage(carton, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  const pixels = image.data;
  const lamp = productLighting[lighting];
  const faces = cartonFaces[flavour];
  const [lightX, lightY, lightZ] = lamp.direction;
  // Approximate each plane's response to the key. Keep a fill term and account
  // for the darker side already baked into the supplied image.
  const front = lamp.ambient + lamp.key * Math.max(0, -0.17 * faces.side * lightX + 0.985 * lightZ);
  const side = (lamp.ambient + lamp.key * Math.max(0, 0.985 * faces.side * lightX + 0.17 * lightZ)) / faces.sourceSideExposure;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const seam = width * (faces.seamTop + (faces.seamBottom - faces.seamTop) * v);
    const vertical = (0.5 - v) * -lightY * lamp.falloff;
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (!pixels[offset + 3]) continue;

      const sideWeight = Math.max(0, Math.min(1, ((x - seam) * faces.side + 1.5) / 3));
      const nearKey = (x / (width - 1) - 0.5) * lightX * 0.35;
      const gain = (front + (side - front) * sideWeight) * (1 + vertical + nearKey) * 4095;

      for (let channel = offset; channel < offset + 3; channel++) {
        pixels[channel] = encoded[Math.min(4095, Math.round(linear[pixels[channel]] * gain))];
      }
    }
  }

  ctx.putImageData(image, 0, 0);
  versions.set(lighting, layer);
  preparedCartons.set(carton, versions);
  return layer;
}
