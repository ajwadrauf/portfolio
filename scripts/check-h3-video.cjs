// Exercise the real example through the real start route. All providers are mocked.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript');
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
function loader(overrides = {}) {
  const cache = {};
  const load = (file) => {
    file = path.resolve(root, file); if (!path.extname(file)) file += '.ts';
    if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    const req = (name) => Object.hasOwn(overrides, name) ? overrides[name] : name === 'server-only' ? {} : name === 'next/server' ? { NextResponse: { json: (data, init) => Response.json(data, init) } } : name.startsWith('@/') ? load('src/' + name.slice(2)) : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(require.resolve(name, { paths: [root] }));
    vm.runInNewContext(source, { require: req, module: mod, exports: mod.exports, process: { env: { FAL_KEY: "synthetic-test-key" }, cwd: () => root }, console, URL, Buffer, Request, Response, Headers, Blob, TextEncoder, Uint8Array, crypto: require('node:crypto').webcrypto, fetch: async () => { throw new Error('Network forbidden'); } }, { filename: file });
    return mod.exports;
  };
  return load;
}
(async () => {
  const queued = []; let consumes = 0, live = false, results = 0;
  const fal = { config() {}, storage: { upload: () => { throw new Error('Unexpected upload'); } }, queue: {
    submit: async (endpoint, { input }) => { queued.push({ endpoint, input }); return { request_id: 'h3-test-request' }; },
    status: async () => ({ status: 'COMPLETED' }), result: async () => { results++; return { data: { video: { url: 'https://media.example/output.mp4' } } }; },
  } };
  const base = loader(), models = base('src/lib/models.ts'), h3 = base('src/lib/h3Video.ts');
  const presets = base('src/lib/adPresets.ts'), sizes = base('src/lib/videoCost.ts'), audio = base('src/lib/adAudio.ts');
  const load = loader({ '@fal-ai/client': { fal }, '@/lib/models': { ...models, hasFalKey: () => true, hasGeminiKey: () => false, isDryRun: () => false }, '@/lib/auth': { unlocked: () => live, consume: () => { consumes++; return { ok: true }; }, liveJson: (_, data) => Response.json(data) } });
  const route = load('src/app/api/ad/start/route.ts');
  const seed = base('src/lib/veluneAdExample.ts').veluneAdExample(base('src/lib/studioProjects.ts').newStudioProject('VELUNE', 'velune').assets);
  const body = { prompt: seed.prompt, modelId: seed.modelId, durationSeconds: seed.duration, aspect: seed.aspect, resolution: seed.resolution, referenceImageDataUrls: seed.references.filter(r => r.kind === 'image').map(r => r.url), referenceVideoUrls: seed.references.filter(r => r.kind === 'video').map(r => r.url), referenceVideoDurations: [15], referenceAudioUrls: [], referenceAudioDurations: [], generateAudio: false };
  const post = (input = body) => route.POST(new Request('https://studio.example/api/ad/start', { method: 'POST', body: JSON.stringify(input) }));
  let response = await post(), json = await response.json();
  check(response.status === 200 && json.mock && queued.length === 0 && consumes === 0, 'Loading/demo starts no paid jobs');
  live = true; response = await post(); json = await response.json();
  check(response.status === 200 && json.falRequestId === 'h3-test-request', 'Actual example reaches the real fal adapter and mocked queue');
  check(queued.length === 1 && consumes === 1, 'One click path creates one queued job');
  const { endpoint, input } = queued[0];
  check(endpoint === 'minimax/h3-max/reference-to-video', 'H3 Reference endpoint, not image-to-video');
  check(input.duration === 15 && input.resolution === '768P' && input.aspect_ratio === '16:9', 'Integer duration, uppercase resolution, matching aspect');
  check(input.enable_safety_checker === true && input.prompt_expansion_mode === 'balanced', 'Safety stays enabled and explicit balanced expansion');
  check(input.reference_image_urls.length === 8 && input.reference_video_urls.length === 1 && input.reference_audio_urls.length === 0, 'Eight images and one guide in documented fields');
  for (const key of ['image_urls', 'video_urls', 'audio_urls', 'image_url', 'end_image_url', 'generate_audio', 'negative_prompt']) check(!(key in input), 'H3 does not send unsupported field ' + key);
  check(!/\[(Image|Video|Audio)\d+\]/.test(input.prompt) && input.prompt.includes('Image 8') && input.prompt.includes('Video 1'), 'Actual prompt uses H3 modality-and-order syntax');
  check(!input.prompt.includes('Generate silent picture') && input.prompt.includes('native audio will be discarded'), 'H3 prompt does not promise an API-silent result');
  check(input.reference_image_urls.every((url, i) => url === 'https://studio.example' + body.referenceImageDataUrls[i]), 'Appearance order and hosted URLs preserved');
  check(Math.abs(json.cost - 3.601615234375) < .001, 'VELUNE estimate includes all measured image pixels and 15s reference footage: $3.60');
  const reject = async (input, expected) => {
    const before = [queued.length, consumes].join();
    const response = await post(input), result = await response.json();
    check(response.status === 400 && result.error.includes(expected), 'Validation: ' + expected + ' (' + JSON.stringify(result) + ')');
    check([queued.length, consumes].join() === before, 'Invalid input never consumes a budget unit or submits');
  };
  for (const durationSeconds of [4, 16, 5.5, '15']) await reject({ ...body, durationSeconds }, '5–15 whole seconds');
  await reject({ ...body, resolution: '720p' }, 'Choose an H3 resolution');
  await reject({ ...body, aspect: '2:1' }, 'aspect ratio');
  await reject({ ...body, endImageDataUrl: body.referenceImageDataUrls[0] }, 'end-frame');
  await reject({ ...body, referenceImageDataUrls: Array(12).fill(body.referenceImageDataUrls[0]) }, '12 references in total');
  await reject({ ...body, referenceImageDataUrls: [], referenceVideoUrls: [], referenceVideoDurations: [] }, 'at least one image or video');
  await reject({ ...body, referenceVideoUrls: ['https://media.example/unknown.mp4'], referenceVideoDurations: undefined }, 'duration is not verified');
  for (const n of [1.9, 15.001, null, '15']) await reject({ ...body, referenceVideoUrls: ['https://media.example/custom.mp4'], referenceVideoDurations: [n] }, typeof n === 'number' ? '2–15 seconds' : 'not verified');
  await reject({ ...body, referenceVideoUrls: ['https://media.example/a.mp4', 'https://media.example/b.mp4'], referenceVideoDurations: [8, 8] }, '15 seconds of video references combined');
  await reject({ ...body, referenceVideoDurations: [15, 2] }, 'durations must match');
  await reject({ ...body, referenceAudioUrls: ['https://media.example/a.mp3'] }, 'Audio durations must match');
  await reject({ ...body, referenceAudioUrls: ['https://media.example/a.mp3'], referenceAudioDurations: [1] }, '2–15 seconds');
  await reject({ ...body, referenceAudioUrls: ['https://media.example/a.mp3', 'https://media.example/b.mp3'], referenceAudioDurations: [10, 6] }, '15 seconds of audio references combined');
  await reject({ ...body, referenceImageDataUrls: ['https://media.example/image.jpg'] }, 'dimensions are not verified');
  await reject({ ...body, referenceImageDataUrls: ['https://media.example/image.jpg'], referenceImageSizes: [{width: 0, height: 100}] }, 'dimensions are not verified');
  await reject({ ...body, referenceImageSizes: [] }, 'Image sizes must match');
  response = await post({ ...body, referenceImageDataUrls: ['https://media.example/image.jpg'], referenceImageSizes: [{width: 1024, height: 1024}], referenceVideoUrls: ['https://media.example/custom.mp4'], referenceVideoDurations: [2], referenceAudioUrls: ['https://media.example/music.mp3'], referenceAudioDurations: [15], prompt: 'Follow [Video1] with @Image 1 and [Audio1].' });
  check(response.status === 200, 'Measured custom image, video and audio accepted');
  check(queued.at(-1).input.prompt === 'Follow Video 1 with Image 1 and Audio 1.', 'Imported brackets and @ syntax translated at the provider boundary');
  check(queued.at(-1).input.reference_audio_urls[0] === 'https://media.example/music.mp3', 'Actual custom audio forwarded once');
  check(audio.audioReferenceProblem([16], 1, h3.H3_MODEL_ID) !== null && audio.audioReferenceProblem([16], 1) === null, 'H3 and Seedance audio constraints remain distinct');
  check(h3.h3ReferenceProblem(8, [15], []) === null && h3.h3ReferenceProblem(12, [2], []), 'Combined reference validator counts all media');
  check(presets.minAdSeconds(h3.H3_MODEL_ID) === 5 && presets.maxAdSeconds(h3.H3_MODEL_ID) === 15, 'Duration UI exposes 5–15s');
  check(presets.audioCapability(h3.H3_MODEL_ID).native && !presets.audioCapability(h3.H3_MODEL_ID).switchable, 'Native audio honestly has no API switch');
  check(sizes.resolutionsFor(h3.H3_MODEL_ID).join() === '480p,768p,1080p' && !sizes.resolutionsFor('seedance-2.5-ref').includes('768p'), 'Resolution menus remain model-specific');
  check(base('src/lib/promptImport.ts').refSlots(seed.prompt).image === 8, 'Prompt completeness reads H3 references');
  check(base('src/lib/adDraft.ts').parseAdDraft(seed).resolution === '768p', 'Example and resolution survive save/reload');
  const old = { ...seed, modelId: 'seedance-2.5-ref', resolution: '720p' };
  check(base('src/lib/adDraft.ts').parseAdDraft(old).modelId === old.modelId, 'Old saved drafts are never migrated implicitly');
  const seedance = { ...body, ...{ modelId: old.modelId, resolution: old.resolution }, prompt: 'Use Image 1 and Video 1.', durationSeconds: 18 };
  response = await post(seedance);
  check(response.status === 200 && queued.at(-1).input.duration === '18' && queued.at(-1).input.resolution === '720p', 'Existing Seedance route still uses its documented request format');
  check(queued.at(-1).input.image_urls.length === 8 && queued.at(-1).input.generate_audio === false && !('reference_image_urls' in queued.at(-1).input), 'Seedance refs/audio switch retained without H3 aliases');
  check(queued.at(-1).input.prompt === 'Use [Image1] and [Video1].', 'Switching a H3 draft to Seedance converts its tokens back');
  const countBeforePoll = queued.length;
  const poll = await load('src/lib/fal.ts').falPollVideo({ endpoint, requestId: 'h3-test-request' });
  check(poll.status === 'done' && poll.videoUrl === 'https://media.example/output.mp4' && results === 1 && queued.length === countBeforePoll, 'Existing queue result path collects H3 without resubmitting');
  console.log(`PASS: ${checks} H3 wire contract, reference limits, pricing, queue and legacy checks. No paid calls.`);
})().catch(error => { console.error(error); process.exit(1); });
