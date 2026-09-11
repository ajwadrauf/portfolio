// Run with: node scripts/check-package-presets.cjs
// Validates the actual preset helpers and package-project reader without a browser.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const clean = (value) => JSON.parse(JSON.stringify(value));
function load(file, dependencies = {}) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module: mod, exports: mod.exports, require: (name) => dependencies[name] });
  return mod.exports;
}
const packaging = load("src/lib/packaging.ts");
const p = load("src/lib/package-presets.ts", { "./packaging": packaging });
const expected = [
  ["BRAND-A-CHIPS-300G", "pillow-bag", 190, 300, 80],
  ["BRAND-A-COOKIES-BOX-500G", "carton", 220, 150, 65],
  ["BRAND-A-CEREAL-BOX-375G", "carton", 190, 280, 60],
  ["BRAND-A-CRACKERS-BOX-200G", "carton", 140, 210, 50],
  ["BRAND-A-TEA-BOX-100G", "carton", 90, 135, 65],
  ["BRAND-A-CHOCOLATE-BOX-200G", "carton", 180, 95, 25],
];
assert.deepEqual(clean(p.STARTER_PACKAGE_PRESETS.map((preset) => [preset.name, preset.shape, preset.dimensions.width, preset.dimensions.height, preset.dimensions.depth])), expected);
assert(p.STARTER_PACKAGE_PRESETS.every((preset) => preset.source === "starter-example" && preset.unit === "mm"));
assert.equal(new Set(p.STARTER_PACKAGE_PRESETS.map((preset) => preset.id)).size, 6);
const starter = p.STARTER_PACKAGE_PRESETS[0];
const own = p.createCompanyPreset("  ACME-CHIPS-300G  ", starter, "in", starter, "company:test-1");
assert.equal(own.name, "ACME-CHIPS-300G");
assert.equal(own.source, "local-company");
assert.equal(own.unit, "in");
assert.equal(own.basedOn.id, starter.id);
assert(p.presetMatches(starter, own));
assert(!p.presetMatches(starter, { ...own, shape: "carton" }));
assert(!p.presetMatches(starter, { ...own, finish: "matte" }));
assert(!p.presetMatches(starter, { ...own, dimensions: { ...own.dimensions, width: 200 } }));
assert.equal(p.presetProvenance(starter, own).modified, false);
assert.equal(p.presetProvenance(starter, { ...own, shape: "carton" }).modified, true);
assert.equal(p.presetProvenance(null, own), null);
const encoded = p.serializePresetLibrary([own]);
assert.deepEqual(clean(p.parsePresetLibrary(encoded)), clean([own]));
for (const bad of [
  null, [], {}, { ...own, shape: "unsupported" }, { ...own, dimensions: { width: "190", height: 300, depth: 80 } },
  { ...own, dimensions: { width: 0, height: 300, depth: 80 } }, { ...own, shape: ["pillow-bag"] },
  { ...own, finish: ["satin"] }, { ...own, unit: ["in"] }, { ...own, source: ["local-company"] },
  { ...own, basedOn: { id: "x", name: "Example", source: "approved-company" } },
]) assert.throws(() => p.readPackagePreset(bad));
for (const bad of ["not JSON", "{}", JSON.stringify({ schema: "packshot-preset-library", version: 2, presets: [] }),
  JSON.stringify({ schema: "packshot-preset-library", version: 1, presets: [starter] }),
  JSON.stringify({ schema: "packshot-preset-library", version: 1, presets: Array(101).fill(own) }),
]) assert.throws(() => p.parsePresetLibrary(bad));

let id = 0;
const newId = () => `company:import-${++id}`;
const before = JSON.stringify(own);
const duplicate = p.mergePresetLibraries([own], [own], newId);
assert.equal(duplicate.added, 0); assert.equal(duplicate.skipped, 1);
const conflict = p.mergePresetLibraries([own], [{ ...own, dimensions: { ...own.dimensions, width: 220 } }], newId);
assert.equal(conflict.presets.length, 2); assert.equal(conflict.renamed, 1);
assert.notEqual(conflict.presets[0].id, conflict.presets[1].id);
assert.match(conflict.presets[1].name, /import 2/);
assert.equal(JSON.stringify(own), before, "imports must not mutate the existing preset");
const originConflict = p.mergePresetLibraries([own], [{ ...own, basedOn: undefined }], newId);
assert.equal(originConflict.added, 1, "different provenance must survive as a separate copy");
const builtinCollision = p.mergePresetLibraries([], [{ ...own, id: starter.id, name: starter.name }], newId);
assert.notEqual(builtinCollision.presets[0].id, starter.id);
assert.notEqual(builtinCollision.presets[0].name, starter.name);
assert.equal(starter.source, "starter-example");
const otherTab = p.createCompanyPreset("ACME-TEA", p.STARTER_PACKAGE_PRESETS[4], "mm", null, "company:other-tab");
const combined = p.mergePresetLibraries([otherTab], [own], newId);
assert.equal(combined.presets.length, 2, "merging latest storage retains another tab's preset");
assert.throws(() => p.mergePresetLibraries(Array.from({ length: 100 }, (_, index) => ({ ...own, id: `company:item-${index}`, name: `ITEM-${index}` })), [own], newId), /exceed 100/);

// Extract and execute the real component's project reader, including old-project compatibility.
const componentText = fs.readFileSync(path.join(root, "src/components/packshots/ArtworkStudio.tsx"), "utf8");
const ast = ts.createSourceFile("ArtworkStudio.tsx", componentText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const reader = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "readProject");
assert(reader, "project reader exists");
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(`${reader.getText(ast)}\nmodule.exports = readProject;`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  module: mod, exports: mod.exports, ...packaging, readPackagePreset: p.readPackagePreset,
  isColor: (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value),
});
const oldProject = { schema: "packshot-box-project", version: 1, name: "Old box", settings: { dimensions: { width: 80, height: 120, depth: 45 }, panels: {}, finish: "matte", baseColor: "#ffffff" }, origins: {} };
assert.equal(mod.exports(JSON.stringify(oldProject)).settings.shape, "carton");
assert.equal(mod.exports(JSON.stringify(oldProject)).displayUnit, "mm");
const bagProject = { ...oldProject, settings: { ...oldProject.settings, shape: "pillow-bag" }, preset: own, displayUnit: "in" };
const restored = mod.exports(JSON.stringify(bagProject));
assert.equal(restored.settings.shape, "pillow-bag");
assert.equal(restored.preset.id, own.id);
assert.equal(restored.preset.basedOn.id, starter.id);
assert.equal(restored.displayUnit, "in");
assert.throws(() => mod.exports(JSON.stringify({ ...bagProject, settings: { ...bagProject.settings, shape: "unknown" } })));
assert.throws(() => mod.exports(JSON.stringify({ ...bagProject, displayUnit: ["in"] })));
console.log("Package preset checks passed: six starter dimensions, strict schema, modified/provenance tracking, safe merge/duplicates/conflicts, other-tab preservation, limits, and old/new project round trips.");
