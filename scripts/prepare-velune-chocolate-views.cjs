const path = require("node:path");
const { mkdir } = require("node:fs/promises");
const sharp = require("sharp");

const source = path.join(__dirname, "../public/studio/velune/references/v2");
const output = path.join(__dirname, "../public/studio/velune/campaign-flow/chocolates");
const views = {
  whole: {
    source: "04_velune_whole_bonbon.jpeg",
    size: [420, 420],
    frame: { left: 0, top: 0, width: 420, height: 420 },
    crop: { left: 68, top: 77, width: 282, height: 264 },
    outline: "M75 253 C70 235 74 207 77 187 C85 153 99 135 121 114 C145 93 171 82 190 81 C221 79 248 88 284 105 C313 118 328 132 336 154 C341 179 344 208 346 229 C346 238 334 252 318 268 L259 329 Q245 341 226 338 C200 333 172 320 148 310 L94 277 Q78 270 75 253 Z",
  },
  front: {
    source: "08_velune_three_flavour_serving.jpeg",
    size: [836, 470],
    frame: { left: 310, top: 125, width: 220, height: 225 },
    crop: { left: 9, top: 18, width: 199, height: 143 },
    outline: "M11 150 C12 132 16 106 19 84 C22 58 32 37 51 27 C68 18 92 18 117 20 C142 20 166 23 180 39 C193 54 198 77 201 102 L207 151 Q206 157 202 158 L12 158 Q8 156 11 150 Z",
  },
  angled: {
    source: "02_velune_raspberry_carton.jpeg",
    frame: { left: 645, top: 289, width: 350, height: 315 },
    crop: { left: 80, top: 76, width: 268, height: 201 },
    outline: "M82 224 C87 197 93 158 106 131 C116 109 134 96 160 85 Q189 74 218 78 C249 79 277 90 297 104 C317 105 332 128 338 164 L346 232 Q347 253 309 273 Q294 277 276 270 L93 237 Q78 235 82 224 Z",
  },
};

async function main() {
  await mkdir(output, { recursive: true });
  for (const [name, view] of Object.entries(views)) {
    let image = sharp(path.join(source, view.source));
    if (view.size) {
      image = sharp(await image.resize(...view.size).png().toBuffer());
    }
    const frame = await image.extract(view.frame).ensureAlpha().png().toBuffer();
    const matte = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${view.frame.width}" height="${view.frame.height}"><path d="${view.outline}" fill="white"/></svg>`);
    const isolated = await sharp(frame).composite([{ input: matte, blend: "dest-in" }]).png().toBuffer();
    await sharp(isolated).extract(view.crop).webp({ lossless: true }).toFile(path.join(output, name + ".webp"));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
