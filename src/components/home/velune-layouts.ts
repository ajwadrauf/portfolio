import { lightCarton, productLighting, type Lighting } from "./velune-lighting";

export const flavours = {
  raspberry: {
    name: "Raspberry Ganache",
    french: "Ganache à la framboise",
    englishHeadline: ["Curiosity tastes", "like this."],
    frenchHeadline: ["Le chocolat.", "Puis la framboise."],
  },
  pistachio: {
    name: "Pistachio Praline",
    french: "Praliné à la pistache",
    englishHeadline: ["A softer side", "of pistachio."],
    frenchHeadline: ["Toute la douceur", "de la pistache."],
  },
  caramel: {
    name: "Salted Caramel",
    french: "Caramel salé",
    englishHeadline: ["Sweet meets", "a pinch of salt."],
    frenchHeadline: ["La douceur,", "une pointe de sel."],
  },
} as const;

export const backdrops = {
  mulberry: { name: "Mulberry", swatch: "#68223d", dark: "#201223", glow: "#8c3b58", floor: "#361626", ink: "#fff3de", accent: "#f0c5aa" },
  midnight: { name: "Midnight", swatch: "#324c62", dark: "#101924", glow: "#476b83", floor: "#202d3e", ink: "#f6f2e5", accent: "#c5dbe9" },
  sand: { name: "Warm sand", swatch: "#dab591", dark: "#e9d8be", glow: "#f8ebd6", floor: "#c8a085", ink: "#34201e", accent: "#6b4639" },
} as const;

export type Flavour = keyof typeof flavours;
export type Backdrop = keyof typeof backdrops;
export type CopyLanguage = "english" | "french";
export type Export = "storefront" | CopyLanguage;
export type Template = Export | "carton";

export type LayoutSettings = {
  carton: HTMLImageElement;
  flavour: Flavour;
  backdrop: Backdrop;
  lighting: Lighting;
};

export function layoutDimensions(template: Template) {
  return template === "storefront" ? { width: 1200, height: 1200 } : { width: 1080, height: 1350 };
}

export function defaultHeadline(flavour: Flavour, language: CopyLanguage) {
  const product = flavours[flavour];
  return (language === "french" ? product.frenchHeadline : product.englishHeadline).join("\n");
}

function headlineLines(ctx: CanvasRenderingContext2D, headline: string, width: number) {
  const [first, ...remaining] = headline.trim().split(/\s*\n\s*/);
  if (remaining.length) return [first, remaining.join(" ")];

  const words = first.split(/\s+/);
  let line = "";
  for (const [index, word] of words.entries()) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) return [line, words.slice(index).join(" ")];
    line = next;
  }
  return [line];
}

function drawCarton(ctx: CanvasRenderingContext2D, carton: CanvasImageSource, centre: number, floor: number, width: number, height: number) {
  ctx.drawImage(carton, centre - width / 2, floor - height, width, height);
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number, shade: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, depth);
  const falloff = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  falloff.addColorStop(0, shade);
  falloff.addColorStop(1, "transparent");
  ctx.fillStyle = falloff;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function drawGroundedCarton(ctx: CanvasRenderingContext2D, settings: LayoutSettings, centre: number, floor: number, height: number, storefront: boolean) {
  const { carton, flavour, lighting } = settings;
  const lamp = productLighting[lighting];
  const width = height * carton.naturalWidth / carton.naturalHeight;
  drawShadow(
    ctx, centre + width * lamp.shadowOffset, floor - 6,
    width * lamp.shadowWidth, lamp.shadowDepth, storefront ? "#2813225c" : "#13080d88",
  );
  drawShadow(ctx, centre, floor - 4, width * 0.58, 0.08, storefront ? "#26152255" : "#13080d9c");
  drawCarton(ctx, lightCarton(carton, flavour, lighting), centre, floor, width, height);
}

function drawSocialSet(ctx: CanvasRenderingContext2D, palette: (typeof backdrops)[Backdrop]) {
  ctx.fillStyle = palette.dark;
  ctx.fillRect(0, 0, 1080, 1350);

  const halo = ctx.createRadialGradient(658, 725, 0, 658, 725, 750);
  halo.addColorStop(0, palette.glow);
  halo.addColorStop(1, palette.dark);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 1080, 1110);

  const floor = ctx.createLinearGradient(0, 1050, 0, 1350);
  floor.addColorStop(0, palette.glow);
  floor.addColorStop(1, palette.floor);
  ctx.fillStyle = floor;
  ctx.fillRect(0, 1050, 1080, 300);

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(638, 1049, 320, 564, -0.5, Math.PI * 0.99, Math.PI * 1.82);
  ctx.stroke();
  ctx.restore();
}

export function drawVeluneLayout(
  canvas: HTMLCanvasElement,
  settings: LayoutSettings,
  template: Template,
  headline?: string,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { carton, flavour, backdrop } = settings;
  const { width, height } = layoutDimensions(template);
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";

  if (template === "carton") {
    drawCarton(ctx, carton, 540, 1210, 1045 * carton.naturalWidth / carton.naturalHeight, 1045);
    return;
  }

  if (template === "storefront") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    drawGroundedCarton(ctx, settings, 600, 994, 828, true);
    return;
  }

  const palette = backdrops[backdrop];
  const product = flavours[flavour];
  const french = template === "french";
  drawSocialSet(ctx, palette);
  drawGroundedCarton(ctx, settings, 575, 1130, 718, false);

  ctx.fillStyle = palette.accent;
  ctx.font = "600 28px Georgia, serif";
  ctx.fillText("VELUNE", 82, 112);
  ctx.fillStyle = palette.ink;
  ctx.font = "88px Georgia, serif";
  const lines = headlineLines(ctx, headline ?? defaultHeadline(flavour, template), 928);
  lines.forEach((line, index) => ctx.fillText(line, 76, 236 + index * 91, 928));

  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(82, 1205);
  ctx.lineTo(998, 1205);
  ctx.stroke();
  ctx.fillStyle = palette.ink;
  ctx.font = "34px Georgia, serif";
  ctx.fillText(french ? product.french : product.name, 82, 1265, 580);
  ctx.textAlign = "right";
  ctx.font = "24px Georgia, serif";
  ctx.fillText(french ? "À découvrir." : "Wonder within.", 998, 1265);
  ctx.textAlign = "start";
}
