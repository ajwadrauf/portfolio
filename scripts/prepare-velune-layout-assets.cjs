const path = require("node:path");
const { mkdir } = require("node:fs/promises");
const sharp = require("sharp");

const source = path.join(__dirname, "../public/studio/velune/references/v2");
const target = path.join(__dirname, "../public/studio/velune/campaign-flow/cartons");

// Each outline traces the carton in its original 1672 × 941 reference.
// The matte supplies transparency while the original decoded print remains intact.
const cartons = [
  {
    name: "raspberry",
    file: "02_velune_raspberry_carton.jpeg",
    outline: "M559 87.8 L1088.9 70.9 Q1092 70.6 1096 72.1 L1134.8 84 L1144.6 90.8 L1144.1 818.4 L1090.1 854.9 L560.1 821.9 L558.6 819.6 L556.8 92.2 Z",
    crop: { left: 555, top: 69, width: 592, height: 788 },
  },
  {
    name: "pistachio",
    file: "01_velune_pistachio_carton.jpeg",
    outline: "M561.2 128 L621.6 104.0 L1108.7 111.9 L1108.6 804.1 L623.2 831.5 L562.1 798.3 Z",
    crop: { left: 559, top: 102, width: 552, height: 732 },
  },
  {
    name: "caramel",
    file: "03_velune_caramel_carton.jpeg",
    outline: "M564.6 97.2 L1055.7 90.4 L1113.5 112 L1113.3 793.6 L1057 825.4 L563.6 802 Z",
    crop: { left: 561, top: 88, width: 555, height: 740 },
  },
];

async function prepareCartons() {
  await mkdir(target, { recursive: true });
  await Promise.all(cartons.map(async ({ name, file, outline, crop }) => {
    const matte = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1672" height="941"><path d="${outline}" fill="white"/></svg>`);
    const masked = await sharp(path.join(source, file)).ensureAlpha()
      .composite([{ input: matte, blend: "dest-in" }]).png().toBuffer();
    await sharp(masked).extract(crop).webp({ lossless: true }).toFile(path.join(target, name + ".webp"));
  }));
}

prepareCartons().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
