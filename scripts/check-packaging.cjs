// Run with: node scripts/check-packaging.cjs
// Offline geometry/UV checks against the installed Three.js implementation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const THREE = require("three");
const source = path.resolve(__dirname, "../src/lib/packaging.ts");
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(source, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: mod, exports: mod.exports });
const p = mod.exports;
const near = (a, b, why) => assert(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
const vector = (array) => new THREE.Vector3(...array);
let checks = 0;

// Test the actual BoxGeometry data, not another copy of its presumed face order.
const geometry = new THREE.BoxGeometry(1.9, 2.5, 0.6);
const positions = geometry.getAttribute("position");
const uvs = geometry.getAttribute("uv");
const normals = geometry.getAttribute("normal");
for (const group of geometry.groups) {
  const face = p.BOX_MATERIAL_FACES[group.materialIndex];
  const axes = p.BOX_FACE_AXES[face];
  const indices = Array.from({ length: group.count }, (_, index) => geometry.index.getX(group.start + index));
  const corners = [...new Set(indices)].map((index) => ({
    position: new THREE.Vector3().fromBufferAttribute(positions, index),
    normal: new THREE.Vector3().fromBufferAttribute(normals, index),
    u: uvs.getX(index), v: uvs.getY(index),
  }));
  near(corners[0].normal.dot(vector(axes.normal)), 1, `${face} material receives the correct face`);
  const origin = corners.find((c) => c.u === 0 && c.v === 0);
  const uEnd = corners.find((c) => c.u === 1 && c.v === 0);
  const vEnd = corners.find((c) => c.u === 0 && c.v === 1);
  const printedRight = uEnd.position.clone().sub(origin.position).normalize();
  const printedUp = vEnd.position.clone().sub(origin.position).normalize();
  near(printedRight.dot(vector(axes.right)), 1, `${face} UV right direction`);
  near(printedUp.dot(vector(axes.up)), 1, `${face} UV up direction`);

  const pose = p.boxCameraPose(face);
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.01, 40);
  camera.position.copy(vector(pose.direction)).multiplyScalar(8);
  camera.up.copy(vector(pose.up));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const screenOrigin = origin.position.clone().project(camera);
  const screenRight = uEnd.position.clone().project(camera);
  const screenUp = vEnd.position.clone().project(camera);
  assert(screenRight.x > screenOrigin.x, `${face} artwork must not be mirrored`);
  assert(screenUp.y > screenOrigin.y, `${face} artwork must not be upside down`);
  checks += 5;
}
geometry.dispose();

const allAngles = [...p.BOX_FACES, "hero34"];
for (const dimensions of [
  { width: 190, height: 250, depth: 60 }, { width: 30, height: 1000, depth: 20 },
  { width: 1000, height: 10, depth: 10 }, { width: 1, height: 1, depth: 1 },
  { width: 10000, height: 10000, depth: 10000 },
]) {
  const d = p.normalizedBoxDimensions(dimensions);
  near(d.width / d.height, dimensions.width / dimensions.height, "measured width/height ratio");
  near(d.depth / d.height, dimensions.depth / dimensions.height, "measured depth/height ratio");
  const halfExtent = p.boxFramingHalfExtent(dimensions);
  for (const angle of allAngles) {
    const pose = p.boxCameraPose(angle);
    const camera = new THREE.OrthographicCamera(-halfExtent, halfExtent, halfExtent, -halfExtent, 0.01, 40);
    camera.position.copy(vector(pose.direction)).normalize().multiplyScalar(8);
    camera.up.copy(vector(pose.up));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const corner = new THREE.Vector3(x * d.width / 2, y * d.height / 2, z * d.depth / 2).project(camera);
      assert(Math.abs(corner.x) < 0.88 && Math.abs(corner.y) < 0.88, `${angle} corner must stay inside common framing with margin`);
      assert(corner.z > -1 && corner.z < 1, `${angle} corner is between clipping planes`);
      checks += 2;
    }
  }
  checks += 2;
}

const contain = p.artworkPlacement(600, 300, 200, 300, 90, "contain");
near(contain.width, 300, "rotated contain draw width");
near(contain.height, 150, "rotated contain preserves image ratio");
near(contain.radians, Math.PI / 2, "positive canvas rotation is clockwise");
const cover = p.artworkPlacement(600, 300, 200, 300, 90, "cover");
near(cover.width, 400, "rotated cover fills face height");
near(cover.height, 200, "rotated cover fills face width");
assert(!p.validBoxDimensions({ width: 0, height: 100, depth: 10 }));
assert(!p.validBoxDimensions({ width: Infinity, height: 100, depth: 10 }));
assert(!p.validBoxDimensions({ width: NaN, height: 100, depth: 10 }));
assert(p.validBoxDimensions({ width: 0.5, height: 100, depth: 10 }));
const panel = { dataUrl: "data:image/png;base64,private-artwork", name: "approved.png", rotation: 90, fit: "contain", background: "#ffffff" };
const coverage = p.coverageForAngle("hero34", { front: panel, left: panel });
assert.equal(JSON.stringify(coverage.mapped), '["front"]');
assert.equal(JSON.stringify(coverage.blank), '["right","top"]');
assert.equal(coverage.complete, false);
const manifest = p.artworkManifest({ dimensions: { width: 190, height: 250, depth: 60 }, panels: { front: panel }, finish: "matte", baseColor: "#ffffff" }, allAngles, 2048);
assert.equal(manifest.panels.length, 6);
assert.equal(manifest.angles.length, 7);
assert.equal(manifest.panels[0].sourceName, "approved.png");
assert.equal(manifest.output.width, 2048);
assert.equal(manifest.dimensions.unit, "mm");
assert(!JSON.stringify(manifest).includes("private-artwork"));
checks += 18;
console.log(`PASS: ${checks} measured-ratio, actual Three.js UV/orientation, seven-angle framing, rotation/fit and manifest checks. No network or AI calls.`);
