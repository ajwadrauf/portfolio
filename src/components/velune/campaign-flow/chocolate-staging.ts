export const chocolateAssets = ["whole", "whole-low", "whole-high", "front", "angled"] as const;

type AssetName = (typeof chocolateAssets)[number];
export const chocolateViews = {
  whole: "Whole · varied angles",
  "whole-low": "Whole · low angle",
  "whole-high": "Whole · overhead",
  front: "Cut · front",
  angled: "Cut · angled",
} as const satisfies Record<AssetName, string>;

export type ChocolateView = keyof typeof chocolateViews;
export type ChocolateLayer = {
  image: HTMLImageElement;
  base: { x: number; y: number }[];
};

type Placement = readonly [x: number, bottom: number, width: number];

// Close groupings keep pieces at scale beside the hero carton. Slots run back to front.
const clusters: readonly (readonly Placement[])[] = [
  [],
  [[824, 1142, 151]],
  [[856, 1113, 133], [783, 1167, 148]],
  [[861, 1099, 127], [770, 1147, 134], [895, 1184, 153]],
  [[819, 1084, 116], [913, 1115, 127], [762, 1160, 136], [890, 1197, 151]],
];

const alternate: readonly (readonly Placement[])[] = [
  [],
  [[861, 1169, 137]],
  [[780, 1104, 128], [891, 1168, 146]],
  [[779, 1097, 121], [904, 1138, 138], [813, 1187, 151]],
  [[876, 1085, 112], [770, 1127, 125], [936, 1156, 138], [828, 1206, 151]],
];

const wholeAngles = ["whole", "whole-low", "whole-high"] as const;

export function readChocolateLayer(image: HTMLImageElement): ChocolateLayer {
  const canvas = document.createElement("canvas");
  const { naturalWidth: width, naturalHeight: height } = image;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { image, base: [] };

  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  const base: ChocolateLayer["base"] = [];
  const stride = Math.max(1, Math.floor(width / 50));
  for (let x = Math.floor(width * 0.045); x < width * 0.955; x += stride) {
    for (let y = height - 1; y >= 0; y--) {
      if (data[(y * width + x) * 4 + 3] > 215) {
        base.push({ x: x / width, y: (y + 1) / height });
        break;
      }
    }
  }
  return { image, base };
}

function softShadow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, depth: number, shade: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, depth);
  const fade = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  fade.addColorStop(0, shade);
  fade.addColorStop(1, "#20091100");
  ctx.fillStyle = fade;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

export function paintChocolateCluster(
  ctx: CanvasRenderingContext2D,
  views: readonly ChocolateView[],
  layers: Record<AssetName, ChocolateLayer>,
  rearranged: boolean,
) {
  if (views.length === 0) return;
  const coordinates = (rearranged ? alternate : clusters)[views.length];
  const pieces = views.map((view, index) => {
    const source = view === "whole" ? wholeAngles[(index + Number(rearranged)) % wholeAngles.length] : view;
    const layer = layers[source];
    const [x, y, width] = coordinates[index];
    const height = width * layer.image.naturalHeight / layer.image.naturalWidth;
    return { layer, x, y, width, height, left: x - width / 2, top: y - height };
  });

  // The clean plate places the hero carton to the left of this staging zone.
  ctx.save();
  ctx.beginPath();
  ctx.rect(656, 0, 424, 1350);
  ctx.clip();
  const nearest = pieces[pieces.length - 1];
  softShadow(ctx, nearest.x + 6, nearest.y - 25, 160, 0.26, "#230b1342");
  pieces.forEach(({ layer, x, y, width, height, left, top }) => {
    softShadow(ctx, x + width * 0.14, y - height * 0.10, width * 0.73, 0.21, "#1b0713a6");

    // A short, dark contact shadow follows the visible base of the actual cutout.
    // Paint all the shadows before the pieces so overlaps stay clean.
    if (!layer.base.length) return;
    ctx.save();
    ctx.beginPath();
    layer.base.forEach((point, index) => {
      const px = left + width * point.x;
      const py = top + height * point.y + 1;
      if (index === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#120509b8";
    ctx.lineWidth = 6.5;
    ctx.shadowColor = "#17060ca8";
    ctx.shadowBlur = 6 * ctx.getTransform().a;
    ctx.stroke();
    ctx.restore();
  });

  pieces.forEach(({ layer, left, top, width, height }) => {
    ctx.drawImage(layer.image, left, top, width, height);
  });
  ctx.restore();
}
