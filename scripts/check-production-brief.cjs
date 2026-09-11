const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { unzipSync, strFromU8 } = require("fflate");
const root = path.resolve(__dirname, "..");
const cache = new Map();
let checks = 0, download, requested = [];
function check(condition, label) { assert.ok(condition, label); checks++; }
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} }; cache.set(filename, module.exports);
  const resolve = (name) => name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(filename), name)) + ".ts") : require(name);
  vm.runInNewContext(source, { require: resolve, module, exports: module.exports, console, Uint8Array, Blob, AbortSignal, setTimeout: (fn) => { fn(); }, URL: { createObjectURL: (blob) => { download = blob; return "blob:test"; }, revokeObjectURL() {} }, document: { createElement: () => ({ click() {} }) }, fetch: async (url) => {
    requested.push(url);
    if (url.startsWith("data:")) return fetch(url);
    if (url === "/blender/CLAUDE.md") return new Response(fs.readFileSync(path.join(root, "public/blender/CLAUDE.md")), { headers: { "content-type": "text/plain" } });
    if (url === "/studio/velune/packaging-concepts.jpg") return new Response(fs.readFileSync(path.join(root, "public/studio/velune/packaging-concepts.jpg")), { headers: { "content-type": "image/jpeg" } });
    return new Response("missing", { status: 404 });
  } }, { filename });
  return module.exports;
}
async function main() {
  const prompts = load("src/lib/promptBuilder.ts"), blender = load("src/lib/blender.ts"), production = load("src/lib/productionBrief.ts"), camera = load("src/lib/cameraRehearsal.ts");
  for (const [seconds, expected] of [[0,"0:00"],[1.5,"0:01.5"],[2.125,"0:02.125"],[59.9995,"1:00"],[60.5,"1:00.5"]]) check(prompts.mmss(seconds) === expected, `fractional display ${seconds}`);
  check(prompts.secondsLabel(14.999999999999998) === "15", "timeline sum hides floating point noise");
  check(prompts.secondsLabel(50 / 24) === "2.083", "duration bands use concise frame-derived seconds");
  check(prompts.secondsLabel(0.375) === "0.375" && prompts.secondsLabel(Infinity) === "—", "brief and invalid durations display consistently");
  const before = [{ id: "a", media: "image", job: "A" }, { id: "v", media: "video", job: "camera" }, { id: "b", media: "image", job: "B" }, { id: "c", media: "image", job: "C" }];
  const after = before.filter((slot) => slot.id !== "a");
  const remapped = prompts.remapReferenceTokens("[Image1] A; [Image2] B; [Image3] C; [Video1] camera", before, after);
  check(remapped === "[MissingImage1] A; [Image1] B; [Image2] C; [Video1] camera", "atomic token remapping keeps identity");
  check(prompts.timelineIssues([], 14, remapped, after).some((issue) => issue.text.includes("removed reference")), "removed reference blocks transfer");
  const changed = before.map((slot) => slot.id === "a" ? { ...slot, media: "audio" } : slot);
  check(prompts.remapReferenceTokens("[Image1] [Image2]", before, changed) === "[Audio1] [Image1]", "media changes preserve slot identity");
  check(prompts.remapReferenceTokens("[Image1] [Image1]", before, before) === "[Image1] [Image1]", "unchanged identity keeps all bindings");
  check(prompts.EXAMPLE_SLOTS[0].job.includes("yellow vanilla"), "example purpose matches subject");
  check(prompts.assemble({}, [{ seconds: 1.5, role: "open", action: "Open", audio: "snap" }, { seconds: 2.5, role: "climax", action: "Close", audio: "" }], 4, "").includes("0:00–0:01.5"), "export retains half-second boundary");
  const general = production.velunePromptDraft(), brief = production.veluneBlenderBrief();
  check(general.duration === 15 && brief.seconds === "15", "VELUNE is 15 seconds in both composers");
  check(general.beats.length === 12 && brief.beats.length === 12, "all twelve real shots retained");
  check(Math.abs(prompts.beatsTotal(general.beats) - 15) < 1e-9, "VELUNE beat durations total fifteen");
  check(Math.round(Number(brief.beats[11].to) * 24) === 360, "final exclusive frame is 360");
  check(Math.round(Number(brief.beats[10].from) * 24) === 242 && Math.round(Number(brief.beats[10].to) * 24) === 314, "report retains exact three-second interval");
  check(brief.creative.includes("not yet produced"), "seed never fabricates completed Seedance result");
  const editedBuild = blender.composeBlenderBuildBrief(brief);
  check(editedBuild.includes("Edited sequence") && !editedBuild.includes("One continuous take"), "VELUNE build preserves its explicit edited structure");
  check(blender.composeBlenderPrompt(brief).includes("hard-cut boundaries"), "video prompt preserves the same cut structure");
  check(blender.composeBlenderBuildBrief(blender.EXAMPLE_BRIEF).includes("One continuous take"), "continuous examples keep their existing contract");
  const oldVelune = { version: 1, brief: { ...brief, editMode: undefined, medium: "chocolate folds and the bonbon merge" }, referenceAssets: {} };
  const normalized = production.normalizeBlenderDraft(oldVelune);
  check(normalized.brief.editMode === "cuts" && normalized.brief.medium === "", "older VELUNE drafts migrate cut mode without a granular-material contract");
  check(JSON.stringify(normalized.brief.beats) === JSON.stringify(oldVelune.brief.beats), "migration preserves exact stored timing");
  const exactBoundary = String(113 / 24);
  check(blender.compactBeatSeconds(exactBoundary) === "4.708", "boundary displays readable abbreviated seconds");
  check(exactBoundary === String(113 / 24) && Math.round(Number(exactBoundary) * 24) === 113, "abbreviation leaves the exact source frame intact");
  check(blender.compactBeatSeconds("") === "" && blender.compactBeatSeconds("bad") === "bad", "unfinished or invalid input remains editable");
  check(production.isPromptDraft(general), "general seed validates");
  check(production.isBlenderDraft({ version: 1, brief, referenceAssets: {} }), "Blender seed validates");
  check(!production.isPromptDraft({ ...general, slots: [{ media: "image", job: "bad", assetId: {} }] }), "malformed asset binding rejected");
  check(!production.isBlenderDraft({ version: 1, brief: { ...brief, physics: "invented" }, referenceAssets: {} }), "invalid physics rejected");
  const malformed = { ...blender.EXAMPLE_BRIEF, beats: [{ from: "bad", to: "4", action: "test" }] };
  check(blender.briefIssues(malformed, "build").some((issue) => issue.field === "blender-beat-0"), "invalid beat has field link");
  check(blender.briefIssues({ ...blender.EXAMPLE_BRIEF, beats: [{ from: "1", to: "3", action: "test" }, { from: "4", to: "8", action: "test" }] }, "build").some((issue) => issue.text.includes("gap")), "unplanned timeline gap detected");
  check(blender.briefIssues({ ...blender.EXAMPLE_BRIEF, lens: "bad" }, "build").some((issue) => issue.field === "blender-lens"), "invalid lens has field link");
  check(blender.briefIssues({ ...blender.EXAMPLE_BRIEF, seconds: "0" }, "build").some((issue) => issue.field === "blender-duration"), "zero duration rejected");
  for (const move of ["orbit", "push", "crane"]) {
    for (const t of [-1, 0, 0.5, 1, 2]) check(camera.rehearsalPose(move, t).position.every(Number.isFinite), `finite camera pose ${move} ${t}`);
    check(JSON.stringify(camera.rehearsalPose(move, -1)) === JSON.stringify(camera.rehearsalPose(move, 0)), "camera clamps negative progress");
    check(JSON.stringify(camera.rehearsalPose(move, 2)) === JSON.stringify(camera.rehearsalPose(move, 1)), "camera clamps end progress");
  }
  check(camera.rehearsalPose("push", 1).position[2] === 4, "push follows three-metre path");
  check(camera.rehearsalPose("crane", 1).position[1] === 6.2, "crane reaches declared elevation");
  const ready = { id: "pack", name: "Packaging concept", kind: "image", status: "ready", url: "/studio/velune/packaging-concepts.jpg" };
  await production.downloadProductionBundle({ name: "test/shot", prompt: "test", buildBrief: "build", draft: { version: 1, brief, referenceAssets: {} }, cues: general.beats, references: [{ token: "[Image1]", job: "concept", asset: ready }, { token: "[Image2]", job: "missing" }, { token: "[Video1]", job: "external", asset: { id: "video", name: "Clip", kind: "video", status: "ready", url: "https://fal.media/example.mp4" } }] });
  check(download?.type === "application/zip", "download creates real ZIP");
  const entries = unzipSync(new Uint8Array(await download.arrayBuffer()));
  for (const file of ["01_seedance_prompt.txt", "02_blender_build_brief.md", "03_shot_source.json", "04_cue_sheet.json", "05_reference_manifest.json", "CLAUDE.md", "README.txt", "references/1_Packaging_concept.jpg"]) check(!!entries[file], `bundle includes ${file}`);
  check(Buffer.from(entries["references/1_Packaging_concept.jpg"]).equals(fs.readFileSync(path.join(root, "public/studio/velune/packaging-concepts.jpg"))), "bundle contains actual concept bytes");
  const manifest = JSON.parse(strFromU8(entries["05_reference_manifest.json"]));
  check(manifest[1].status === "missing", "missing reference is explicit");
  check(manifest[2].status.includes("external link"), "external source remains a labelled link");
  check(!requested.some((url) => url.startsWith("https:")), "bundle never calls a remote provider");
  download = undefined;
  await assert.rejects(() => production.downloadProductionBundle({ name: "missing", prompt: "x", draft: {}, cues: [], references: [{ token: "[Image1]", job: "bad", asset: { ...ready, url: "/missing.jpg" } }] })); checks++;
  check(!download, "failed attachment never downloads an incomplete ZIP");
  // Execute the real draft hook with a minimal React lifecycle, rather than inspecting source strings.
  const hookModule = { exports: {} }, cells = [], effects = [];
  let cursor = 0, selected = { id: "A", drafts: {} }, saves = [];
  const react = {
    useRef(initial) { const i = cursor++; if (!cells[i]) cells[i] = { current: initial }; return cells[i]; },
    useState(initial) { const i = cursor++; if (!(i in cells)) cells[i] = typeof initial === "function" ? initial() : initial; return [cells[i], (next) => { cells[i] = typeof next === "function" ? next(cells[i]) : next; }]; },
    useEffect(effect, dependencies) { const i = cursor++, old = cells[i]; if (!old || dependencies.some((value, j) => !Object.is(old[j], value))) effects.push(effect); cells[i] = dependencies; },
  };
  const hookCode = ts.transpileModule(fs.readFileSync(path.join(root, "src/components/studio/useProductionDraft.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(hookCode, { exports: hookModule.exports, module: hookModule, require: (name) => name === "react" ? react : { useStudioProject: () => { const id = selected.id; return { project: selected, ready: true, saveDraft: async (tool, value) => { saves.push({ id, tool, value }); } }; } } });
  const initial = { text: "" }, isDraft = (value) => !!value && typeof value.text === "string";
  const renderHook = () => { cursor = 0; const result = hookModule.exports.useProductionDraft("prompt", initial, isDraft); const pending = effects.splice(0); pending.forEach((effect) => effect()); return result; };
  renderHook(); let hook = renderHook();
  check(hook.loaded && hook.value.text === "", "draft hydrates before reporting ready");
  hook.setValue({ text: "keep A" }); hook = renderHook();
  check(saves.at(-1).id === "A" && saves.at(-1).value.text === "keep A", "typing saves into original project");
  selected = { id: "A", drafts: { prompt: { text: "stale echo" } } }; hook = renderHook();
  check(hook.value.text === "keep A", "save echoes cannot overwrite current typing");
  const beforeSwitch = saves.length;
  selected = { id: "B", drafts: { prompt: { text: "saved B" } } }; renderHook(); hook = renderHook();
  check(hook.value.text === "saved B", "changing project hydrates its own draft");
  check(saves.length === beforeSwitch, "project switch never writes old A values into B");
  hook.setValue({ text: "new B" }); hook = renderHook(); await hook.flush();
  check(saves.at(-1).id === "B" && saves.at(-1).value.text === "new B", "explicit handoff flush saves the current project");
  console.log(`Production brief: ${checks} checks passed. No provider calls.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
