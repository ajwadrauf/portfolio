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
const rendererModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../src/components/packshots/box-renderer.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  module: rendererModule, exports: rendererModule.exports,
  require: (name) => {
    if (name === "three") return THREE;
    if (name === "@/lib/packaging") return p;
    throw new Error(`Unexpected renderer dependency: ${name}`);
  },
});
const { createPackageGeometry } = rendererModule.exports;
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

// The optional shape must not change the geometry of old carton projects at all.
const oldDimensions = { width: 80, height: 120, depth: 45 };
const oldD = p.normalizedBoxDimensions(oldDimensions);
const originalCarton = new THREE.BoxGeometry(oldD.width, oldD.height, oldD.depth);
for (const shape of [undefined, "carton"]) {
  const carton = createPackageGeometry(oldDimensions, shape);
  for (const attribute of ["position", "normal", "uv"]) {
    assert.deepEqual(carton.getAttribute(attribute).array, originalCarton.getAttribute(attribute).array, `carton ${attribute} remains byte-for-byte unchanged`);
    checks++;
  }
  assert.deepEqual(carton.index.array, originalCarton.index.array);
  assert.deepEqual(carton.groups, originalCarton.groups);
  checks += 2;
  carton.dispose();
}
originalCarton.dispose();

for (const dimensions of [
  { width: 190, height: 300, depth: 80 },
  { width: 60, height: 400, depth: 12 },
  { width: 300, height: 120, depth: 45 },
]) {
  const d = p.normalizedBoxDimensions(dimensions);
  const bag = createPackageGeometry(dimensions, "pillow-bag");
  const topology = new THREE.BoxGeometry(d.width, d.height, d.depth, 24, 64, 12);
  assert.deepEqual(bag.index.array, topology.index.array, "pillow bag preserves the box triangle winding");
  assert.deepEqual(bag.groups, topology.groups, "pillow bag preserves all six material assignments");
  assert.deepEqual(bag.getAttribute("uv").array, topology.getAttribute("uv").array, "pillow bag never edits, rotates or mirrors panel UVs");
  checks += 3;
  const bounds = bag.boundingBox;
  for (const [axis, length] of [["x", d.width], ["y", d.height], ["z", d.depth]]) {
    near(bounds.min[axis], -length / 2, `pillow bag minimum ${axis} bound`);
    near(bounds.max[axis], length / 2, `pillow bag maximum ${axis} bound`);
    checks += 2;
  }
  const bagPositions = bag.getAttribute("position");
  const bagNormals = bag.getAttribute("normal");
  for (let index = 0; index < bagPositions.count; index++) {
    const position = new THREE.Vector3().fromBufferAttribute(bagPositions, index);
    const normal = new THREE.Vector3().fromBufferAttribute(bagNormals, index);
    assert([...position, ...normal].every(Number.isFinite), "deformation produces finite positions/normals");
    near(normal.length(), 1, "deformed vertex normal is normalized");
    assert(Math.abs(position.x) <= d.width / 2 + 1e-6 && Math.abs(position.y) <= d.height / 2 + 1e-6 && Math.abs(position.z) <= d.depth / 2 + 1e-6, "every bag vertex stays within the requested external bounds");
    checks += 3;
  }
  for (const group of bag.groups) {
    const axis = vector(p.BOX_FACE_AXES[p.BOX_MATERIAL_FACES[group.materialIndex]].normal);
    const faceVertices = new Set(Array.from({ length: group.count }, (_, index) => bag.index.getX(group.start + index)));
    for (const index of faceVertices) {
      const normal = new THREE.Vector3().fromBufferAttribute(bagNormals, index);
      assert(normal.dot(axis) > 0, "recomputed and smoothed normals point outward from their assigned face");
      checks++;
    }
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(bagPositions, bag.index.getX(offset));
      const b = new THREE.Vector3().fromBufferAttribute(bagPositions, bag.index.getX(offset + 1));
      const c = new THREE.Vector3().fromBufferAttribute(bagPositions, bag.index.getX(offset + 2));
      const surfaceNormal = b.sub(a).cross(c.sub(a));
      assert(surfaceNormal.lengthSq() > 1e-18, "pillow bag has no collapsed triangles, including its thin seals");
      assert(surfaceNormal.dot(axis) > 0, "deformation never inverts a panel's triangle winding");
      checks += 2;
    }
  }
  for (const angle of allAngles) {
    const pose = p.boxCameraPose(angle);
    const declaredRegions = p.visibleFaces(angle, "pillow-bag");
    const cameraDirection = vector(pose.direction).normalize();
    // Conservative coverage must include every material with triangles facing the
    // actual camera, even when another part of the curved bag may occlude them.
    for (const group of bag.groups) {
      let facesCamera = false;
      for (let offset = group.start; offset < group.start + group.count; offset += 3) {
        const a = new THREE.Vector3().fromBufferAttribute(bagPositions, bag.index.getX(offset));
        const b = new THREE.Vector3().fromBufferAttribute(bagPositions, bag.index.getX(offset + 1));
        const c = new THREE.Vector3().fromBufferAttribute(bagPositions, bag.index.getX(offset + 2));
        if (b.sub(a).cross(c.sub(a)).normalize().dot(cameraDirection) > 1e-6) { facesCamera = true; break; }
      }
      if (facesCamera) assert(declaredRegions.includes(p.BOX_MATERIAL_FACES[group.materialIndex]), `${angle} coverage must include the curved ${p.BOX_MATERIAL_FACES[group.materialIndex]} artwork region`);
      checks++;
    }
    const half = p.boxFramingHalfExtent(dimensions);
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 40);
    camera.position.copy(vector(pose.direction)).normalize().multiplyScalar(8);
    camera.up.copy(vector(pose.up)); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    for (let index = 0; index < bagPositions.count; index++) {
      const projected = new THREE.Vector3().fromBufferAttribute(bagPositions, index).project(camera);
      assert(Math.abs(projected.x) < 0.88 && Math.abs(projected.y) < 0.88 && projected.z > -1 && projected.z < 1, `${angle} keeps the complete pillow-bag mesh in frame`);
      checks++;
    }
  }
  const topFront = p.pillowBagPoint([0, d.height / 2, d.depth / 2], d);
  const centerFront = p.pillowBagPoint([0, 0, d.depth / 2], d);
  const sealSide = p.pillowBagPoint([d.width / 2, d.height / 2, 0], d);
  near(topFront[2] / centerFront[2], 0.04, "sealed end is thin compared with inflated body");
  near(sealSide[0] / (d.width / 2), 0.88, "sealed ends are narrower than the inflated body");
  checks += 2;
  topology.dispose(); bag.dispose();
}
const legacyManifest = p.artworkManifest({ dimensions: oldDimensions, panels: {}, finish: "matte", baseColor: "#ffffff" }, allAngles, 1024);
const bagManifest = p.artworkManifest({ dimensions: oldDimensions, shape: "pillow-bag", panels: {}, finish: "matte", baseColor: "#ffffff" }, allAngles, 1024);
assert.equal(legacyManifest.shape, "carton");
assert.equal(legacyManifest.geometry, "rectangular-carton");
assert.equal(bagManifest.shape, "pillow-bag");
assert.equal(bagManifest.schemaVersion, 2);
assert(bagManifest.geometryNote.includes("Conceptual"));
checks += 5;
// A supplied side panel alone does not cover front/back artwork visible around a bag.
const leftOnlyBag = p.coverageForAngle("left", { left: panel }, "pillow-bag");
assert.equal(leftOnlyBag.complete, false);
assert.equal(JSON.stringify(leftOnlyBag.blank), '["front","back"]');
assert.equal(p.coverageForAngle("left", { left: panel }).complete, true, "legacy carton coverage remains unchanged");
const allPanels = Object.fromEntries(p.BOX_FACES.map((face) => [face, panel]));
for (const angle of allAngles) {
  assert.equal(p.coverageForAngle(angle, allPanels, "pillow-bag").complete, true);
  const regions = p.visibleFaces(angle, "pillow-bag");
  assert.equal(new Set(regions).size, regions.length, "coverage has no duplicated material regions");
  const manifestAngle = bagManifest.angles.find((entry) => entry.angle === angle);
  assert.equal(JSON.stringify(manifestAngle.visible), JSON.stringify(regions), "manifest uses shape-aware coverage");
  checks += 3;
}
assert.equal(p.visibleFaces("hero34", "pillow-bag").length, 5);
assert(!p.visibleFaces("hero34", "pillow-bag").includes("bottom"));
checks += 5;
console.log(`PASS: ${checks} carton compatibility, pillow-bag bounds/winding/normals, actual Three.js UV/orientation, seven-angle framing, rotation/fit and manifest checks. No network or AI calls.`);
