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
export type Export = "storefront" | "english" | "french";
export type Template = Export | "carton";

export function layoutDimensions(template: Template) {
  return template === "storefront" ? { width: 1200, height: 1200 } : { width: 1080, height: 1350 };
}

function drawCarton(ctx: CanvasRenderingContext2D, carton: HTMLImageElement, centre: number, floor: number, height: number) {
  const width = height * carton.naturalWidth / carton.naturalHeight;
  ctx.drawImage(carton, centre - width / 2, floor - height, width, height);
}

function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, shade: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, 0.19);
  const falloff = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  falloff.addColorStop(0, shade);
  falloff.addColorStop(1, "transparent");
  ctx.fillStyle = falloff;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
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

export function drawVeluneLayout(canvas: HTMLCanvasElement, carton: HTMLImageElement, flavour: Flavour, backdrop: Backdrop, template: Template) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = layoutDimensions(template);
  ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";

  if (template === "carton") {
    drawCarton(ctx, carton, 540, 1210, 1045);
    return;
  }

  if (template === "storefront") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    drawShadow(ctx, 642, 991, 365, "#30162655");
    drawShadow(ctx, 607, 996, 296, "#2a11183b");
    drawCarton(ctx, carton, 600, 994, 828);
    return;
  }

  const palette = backdrops[backdrop];
  const product = flavours[flavour];
  const french = template === "french";
  const lines = french ? product.frenchHeadline : product.englishHeadline;
  drawSocialSet(ctx, palette);
  drawShadow(ctx, 628, 1130, 353, "#13080d80");
  drawShadow(ctx, 588, 1132, 239, "#13080d72");
  drawCarton(ctx, carton, 575, 1130, 718);

  ctx.fillStyle = palette.accent;
  ctx.font = "600 28px Georgia, serif";
  ctx.fillText("VELUNE", 82, 112);
  ctx.fillStyle = palette.ink;
  ctx.font = "88px Georgia, serif";
  ctx.fillText(lines[0], 76, 236, 928);
  ctx.fillText(lines[1], 76, 327, 928);

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
