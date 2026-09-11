// Run with: node scripts/check-artwork.cjs
// Exercises the actual importer with real PNG/PDF pixels, no browser or remote requests.
// With --fixtures, also writes two clearly labeled, nonprivate upload fixtures to /tmp.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const ts = require("typescript");
const canvas = require("@napi-rs/canvas"); // PDF.js' installed canvas dependency.

global.DOMMatrix = canvas.DOMMatrix;
global.ImageData = canvas.ImageData;
global.Path2D = canvas.Path2D;

function twoPagePdf() {
  const pageOne = [
    "1 0 0 rg 0 300 400 300 re f", "0 1 0 rg 400 300 400 300 re f",
    "0 0 1 rg 0 0 400 300 re f", "1 1 1 rg 400 0 400 300 re f",
    "1 1 1 rg BT /F1 28 Tf 40 530 Td (FRONT  UP ->) Tj ET",
    "0 0 0 rg BT /F1 28 Tf 440 530 Td (RIGHT  UP ->) Tj ET",
    "1 1 1 rg BT /F1 28 Tf 40 230 Td (BACK  UP ->) Tj ET",
    "0 0 0 rg BT /F1 28 Tf 440 230 Td (BOTTOM  UP ->) Tj ET",
  ].join("\n");
  const pageTwo = "1 1 0 rg 0 0 800 600 re f\n0 0 0 rg BT /F1 36 Tf 80 470 Td (PAGE TWO / TOP / UP ->) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 600] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 600] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>",
    ...[pageOne, pageTwo].map((content) => `<< /Length ${content.length} >>\nstream\n${content}\nendstream`),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let data = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(data));
    data += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(data);
  data += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  data += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  data += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(data);
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfProxy = { ...pdfjs, GlobalWorkerOptions: {
    set workerSrc(value) {
      assert.equal(value, "/pdf.worker.min.mjs", "browser worker is same-origin");
      pdfjs.GlobalWorkerOptions.workerSrc = path.join(root, "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs");
    },
  } };
  const urls = new Map();
  let nextUrl = 0;
  class LocalImage extends canvas.Image {
    get naturalWidth() { return this.width; }
    get naturalHeight() { return this.height; }
    set src(value) {
      if (!value) return;
      const file = urls.get(value);
      assert(file, "image importer only loads a local object URL");
      file.arrayBuffer().then((buffer) => { super.src = Buffer.from(buffer); });
    }
  }
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, "src/lib/artwork.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module: mod, exports: mod.exports, crypto, DOMException, Uint8Array, Blob, atob, setTimeout,
    require: (name) => name === "pdfjs-dist/legacy/build/pdf.mjs" ? pdfProxy : require(name),
    Image: LocalImage,
    URL: {
      createObjectURL(file) { const url = `local:${++nextUrl}`; urls.set(url, file); return url; },
      revokeObjectURL(url) { urls.delete(url); },
    },
    document: { createElement(tag) { assert.equal(tag, "canvas"); return canvas.createCanvas(1, 1); } },
  });
  const artwork = mod.exports;
  const original = canvas.createCanvas(800, 600);
  const context = original.getContext("2d");
  for (const [color, x, y, label, textColor] of [
    ["#f00", 0, 0, "FRONT  UP ->", "#fff"], ["#0f0", 400, 0, "RIGHT  UP ->", "#000"],
    ["#00f", 0, 300, "BACK  UP ->", "#fff"], ["#fff", 400, 300, "BOTTOM  UP ->", "#000"],
  ]) {
    context.fillStyle = color;
    context.fillRect(x, y, 400, 300);
    context.fillStyle = textColor;
    context.font = "28px sans-serif";
    context.fillText(label, x + 40, y + 70);
  }
  async function pixel(raster, x = 5, y = 5) {
    const decoded = await canvas.loadImage(Buffer.from(artwork.pngDataBytes(raster.dataUrl)));
    const output = canvas.createCanvas(raster.width, raster.height);
    output.getContext("2d").drawImage(decoded, 0, 0);
    return Array.from(output.getContext("2d").getImageData(x, y, 1, 1).data);
  }
  const pngBytes = original.toBuffer("image/png");
  const file = new File([pngBytes], "labeled-panels.png", { type: "image/png" });
  const source = await artwork.openArtwork(file);
  const preview = await source.rasterize(1, undefined, 100);
  assert.equal(preview.width, 100); assert.equal(preview.height, 75);
  const crop = await source.rasterize(1, { x: .5, y: 0, width: .5, height: .5 }, 4096);
  assert.equal(crop.width, 400, "crop comes from the original, without upscaling");
  assert.equal(crop.height, 300);
  assert.deepEqual(await pixel(crop), [0, 255, 0, 255]);
  assert.deepEqual(await pixel(crop, 399, 299), [0, 255, 0, 255], "native crop edges retain exact source pixels");
  assert(artwork.validArtworkCrop({ x: 0, y: 0, width: 1, height: 1 }));
  for (const crop of [
    { x: -.1, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 0, height: 1 },
    { x: .9, y: 0, width: .2, height: 1 }, { x: NaN, y: 0, width: 1, height: 1 },
  ]) assert(!artwork.validArtworkCrop(crop));
  await assert.rejects(() => source.rasterize(1, { x: .9, y: 0, width: .2, height: 1 }), /crop inside/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => artwork.openArtwork(file, controller.signal), (error) => error.name === "AbortError");
  await assert.rejects(() => artwork.openArtwork(new File(["bad"], "script.svg", { type: "image/svg+xml" })), /Use a PDF/);
  await assert.rejects(() => artwork.openArtwork(new File([], "empty.png", { type: "image/png" })), /smaller than 40 MB/);
  source.dispose(); assert.equal(urls.size, 0);
  await assert.rejects(() => source.rasterize(1), /removed/);
  assert.equal(artwork.artworkFileName("../../hello <world>"), "hello-world");
  assert.throws(() => artwork.pngDataBytes("https://example.invalid/image.png"), /local PNG/);

  const pdfBytes = twoPagePdf();
  if (process.argv.includes("--fixtures")) {
    fs.writeFileSync("/tmp/packshot-artwork-panels.png", pngBytes);
    fs.writeFileSync("/tmp/packshot-two-pages.pdf", pdfBytes);
    console.log("Fixtures: /tmp/packshot-artwork-panels.png and /tmp/packshot-two-pages.pdf");
  }
  const pdfSource = await artwork.openArtwork(new File([pdfBytes], "two-pages.pdf", { type: "application/pdf" }));
  assert.equal(pdfSource.pageCount, 2);
  const pdfPreview = await pdfSource.rasterize(1, undefined, 160);
  assert.equal(pdfPreview.width, 160); assert.equal(pdfPreview.height, 120);
  const pdfCrop = await pdfSource.rasterize(1, { x: .5, y: 0, width: .5, height: .5 }, 800);
  assert.equal(pdfCrop.width, 800); assert.equal(pdfCrop.height, 600);
  assert.deepEqual(await pixel(pdfCrop), [0, 255, 0, 255], "PDF crop uses normalized top-left coordinates");
  assert.deepEqual(await pixel(await pdfSource.rasterize(2, undefined, 800)), [255, 255, 0, 255], "page selection uses the requested PDF page");
  await assert.rejects(() => pdfSource.rasterize(3), /valid PDF page/);
  pdfSource.dispose();
  console.log("Artwork checks passed: original PNG pixels, crop bounds, size/type validation, cancellation, disposal, PDF pages/crops, same-origin worker, safe local exports.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
