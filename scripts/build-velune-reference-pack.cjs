// Rebuild the downloadable pack from checked-in assets. No network or generation.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), ts = require('typescript'), { zipSync, strToU8 } = require('fflate');
const cache = {};
function load(file) {
  file = path.resolve(root, file); if (!path.extname(file)) file += '.ts';
  if (cache[file]) return cache[file].exports;
  const mod = { exports: {} }; cache[file] = mod;
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: mod.exports, module: mod, require: n => load(n.startsWith('@/') ? 'src/' + n.slice(2) : path.resolve(path.dirname(file), n)) });
  return mod.exports;
}
const { VELUNE_REFERENCES } = load('src/lib/veluneReferences.ts');
const { VELUNE_H3_PROMPT, VELUNE_MUSIC_BRIEF, VELUNE_SOUND_PLAN, VELUNE_EFFECT_CUES } = load('src/lib/veluneAdContent.ts');
const files = {}, read = p => new Uint8Array(fs.readFileSync(path.join(root, p)));
const named = JSON.parse(fs.readFileSync(path.join(root, 'docs/velune/REFERENCE_V2_FILES.json'), 'utf8'));
for (const r of VELUNE_REFERENCES) files['images/' + r.fileName] = read('public' + r.url);
files['video/00_velune_blender_motion_15s.mp4'] = read('public/studio/velune/animatic.mp4');
files['01_h3_max_prompt.txt'] = strToU8(VELUNE_H3_PROMPT + '\n');
files['02_elevenlabs_music_brief.txt'] = strToU8(VELUNE_MUSIC_BRIEF + '\n');
files['03_sound_plan.json'] = strToU8(JSON.stringify({ soundPlan: VELUNE_SOUND_PLAN, effects: VELUNE_EFFECT_CUES }, null, 2));
files['reference_manifest.json'] = strToU8(JSON.stringify(VELUNE_REFERENCES.map(r => ({ image: r.index, file: 'images/' + r.fileName, role: r.role, shots: r.shotIds })), null, 2));
files['source_filenames.json'] = strToU8(JSON.stringify(named, null, 2));
files['finishing/velune_centre_report_v2.svg'] = read('public/studio/velune/finishing/velune_centre_report_v2.svg');
files['README.txt'] = strToU8(`VELUNE v2 — H3 Max reference pack

Upload the eleven JPEGs from images/ in numeric order. Add the unchanged video as Video 1.
Use 01_h3_max_prompt.txt with H3 Max Reference: 15 seconds, 16:9, 768p, External soundtrack.
Eleven images + one video use H3's twelve-file limit. Do not attach the SVG report, collage, old portraits or audio as extra references.
The JPEGs retain their original dimensions. Nine supplied PNGs were converted to high-quality JPEG; the two older chocolate JPEGs were copied unchanged.
source_filenames.json identifies every original file and the excluded collage.

The elevenlabs files are direction, not generated sound. Keep music-as-reference off. Generate/audition sound separately in Ad Lab and align it to the accepted picture.
The exact report SVG is for final compositing over S11 (10.083–13.083s). It is not automatically inserted into a generated MP4. Review package lettering in the final take.
Loading the example does not spend or overwrite older projects. No new film was generated while preparing this pack. The Seedance example toggle is deferred.
`);
fs.writeFileSync(path.join(root, 'production/velune/work/prompts/h3_max_master.txt'), VELUNE_H3_PROMPT + '\n');
fs.writeFileSync(path.join(root, 'public/studio/velune/h3_max_v2_prompt.txt'), VELUNE_H3_PROMPT + '\n');
fs.writeFileSync(path.join(root, 'public/studio/velune/velune_h3_v2_pack.zip'), zipSync(files, { level: 1 }));
console.log(`Built VELUNE v2 pack: ${VELUNE_REFERENCES.length} images, one unchanged guide, prompt, sound direction and report master.`);
