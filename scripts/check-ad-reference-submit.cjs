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
    vm.runInNewContext(source, { require: req, module: mod, exports: mod.exports, process: { env: {}, cwd: () => root }, console, URL, Buffer, Request, Response, Headers, Blob, TextEncoder, Uint8Array, crypto: require('node:crypto').webcrypto, fetch: async () => { throw new Error('Network forbidden'); } }, { filename: file });
    return mod.exports;
  };
  return load;
}
(async () => {
  const load = loader(), models = load('src/lib/models.ts');
  const seed = load('src/lib/veluneAdExample.ts').veluneAdExample(load('src/lib/studioProjects.ts').newStudioProject('VELUNE', 'velune').assets);
  const body = {
    prompt: seed.prompt, modelId: seed.modelId, aspect: seed.aspect, durationSeconds: seed.duration,
    resolution: seed.resolution, generateAudio: seed.audioMode !== 'silent', inputVideoSeconds: 15,
    referenceImageDataUrls: seed.references.filter(r => r.kind === 'image').map(r => r.url),
    referenceVideoUrls: seed.references.filter(r => r.kind === 'video').map(r => r.url),
  };
  let live = false, consumes = 0;
  const submissions = [], uploads = [];
  const makeRoute = () => loader({
    '@/lib/models': { ...models, hasFalKey: () => true, hasGeminiKey: () => false, isDryRun: () => false },
    '@/lib/auth': { unlocked: () => live, consume: () => { consumes++; return { ok: true }; }, liveJson: (_spend, data) => Response.json(data) },
    '@/lib/fal': {
      falStartVideo: async (input) => { submissions.push(input); return { requestId: 'mock-request' }; },
      falUpload: async (blob) => { uploads.push({ type: blob.type, bytes: Buffer.from(await blob.arrayBuffer()) }); return { url: 'https://storage.example/' + uploads.length }; },
    },
  })('src/app/api/ad/start/route.ts');
  const route = makeRoute();
  const post = (input = body, origin = 'https://studio.example', handler = route) => handler.POST(new Request(origin + '/api/ad/start', { method: 'POST', body: JSON.stringify(input) }));

  const demo = await post(), demoJson = await demo.json();
  check(demo.status === 200 && demoJson.mock === true, 'The actual nine-image VELUNE example passes demo validation: ' + JSON.stringify(demoJson));
  check(consumes === 0 && submissions.length === 0 && uploads.length === 0, 'Demo performs no budget, upload or generation operation');
  live = true;
  const accepted = await post();
  check(accepted.status === 200 && (await accepted.json()).falRequestId === 'mock-request', 'Actual VELUNE preset accepted by mocked live route');
  check(submissions.length === 1 && consumes === 1 && uploads.length === 0, 'One submission, no storage upload on public origin');
  check(submissions[0].referenceImageDataUrls.length === 9 && submissions[0].referenceVideoUrls.length === 1, 'All ten references forwarded without discards');
  body.referenceImageDataUrls.forEach((url, i) => check(submissions[0].referenceImageDataUrls[i] === 'https://studio.example' + url, 'Image' + (i + 1) + ' stays in order and is provider-reachable'));
  check(submissions[0].referenceVideoUrls[0] === 'https://studio.example' + body.referenceVideoUrls[0], 'Blender video becomes provider-reachable');
  check(submissions[0].generateAudio === undefined && submissions[0].inputFormat === 'h3-reference' && submissions[0].durationSeconds === 15 && submissions[0].resolution === '768p', 'H3 15s / 768p settings preserved without an unsupported audio switch');

  const rejected = async (input, message) => {
    const before = [consumes, submissions.length, uploads.length].join();
    const response = await post(input), json = await response.json();
    check(response.status === 400 && json.error.includes(message), 'Specific validation error: ' + message);
    check([consumes, submissions.length, uploads.length].join() === before, 'Rejected references never consume, upload or submit');
    return json.error;
  };
  const invalid = await rejected({ ...body, referenceImageDataUrls: [body.referenceImageDataUrls[0], '/studio/velune/references/unlisted.jpeg'] }, '[Image2]');
  check(!invalid.includes('at most 30'), 'Unsupported file is not misreported as a count problem');
  await rejected({ ...body, referenceImageDataUrls: Array(31).fill(body.referenceImageDataUrls[0]) }, '31 attached');
  await rejected({ ...body, imageDataUrl: body.referenceImageDataUrls[0], referenceImageDataUrls: Array(30).fill(body.referenceImageDataUrls[0]) }, 'at most 8');
  await rejected({ ...body, referenceImageDataUrls: 'not-an-array' }, 'file list');
  await rejected({ ...body, referenceImageDataUrls: [body.referenceVideoUrls[0]] }, '[Image1]');
  await rejected({ ...body, referenceVideoUrls: [body.referenceImageDataUrls[0]] }, '[Video1]');
  for (const url of ['/studio/velune/references/../private.jpeg', '/studio/velune/references/%2e%2e/private.jpeg', 'http://localhost/private.jpeg', 'https://127.0.0.1/private.jpeg']) await rejected({ ...body, referenceImageDataUrls: [url] }, '[Image1]');

  const ordinary = { ...body, modelId: 'seedance-2.5-ref', resolution: '720p', referenceImageDataUrls: ['data:image/jpeg;base64,YQ==', 'https://cdn.example/user.jpeg'], referenceVideoUrls: ['https://cdn.example/user.mp4'] };
  check((await post(ordinary)).status === 200, 'Existing inline and hosted uploads remain accepted');
  check(submissions.at(-1).referenceImageDataUrls.join() === ordinary.referenceImageDataUrls.join(), 'Existing inline and hosted URLs remain unchanged');
  const legacy = { ...body, modelId: 'seedance-2.5-ref', resolution: '720p', referenceImageDataUrls: ['/studio/velune/packaging-concepts.jpg'] };
  check((await post(legacy)).status === 200, 'Older saved VELUNE drafts remain accepted');

  const localRoute = makeRoute(); // A fresh process has no public-origin URL cache.
  const local = await post(body, 'http://localhost:3035', localRoute);
  check(local.status === 200 && uploads.length === 10, 'Local development uploads all ten named files through mocked storage');
  const localSubmission = submissions.at(-1);
  const uploadedUrl = url => 'https://storage.example/' + (uploads.findIndex(upload => upload.bytes.equals(fs.readFileSync(path.join(root, 'public', url)))) + 1);
  check(localSubmission.referenceImageDataUrls.every((url, i) => url === uploadedUrl(body.referenceImageDataUrls[i])) && localSubmission.referenceVideoUrls[0] === uploadedUrl(body.referenceVideoUrls[0]), 'Locally uploaded references retain their positions despite parallel reads');
  for (const url of [...body.referenceImageDataUrls, ...body.referenceVideoUrls]) {
    const original = fs.readFileSync(path.join(root, 'public', url));
    check(uploads.some(upload => upload.bytes.equals(original) && upload.type === (url.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg')), 'Uploads original bytes and media type for ' + path.basename(url));
  }
  console.log(`PASS: ${checks} actual VELUNE submission, positional references, local storage and rejection checks. No paid calls.`);
})().catch(error => { console.error(error); process.exit(1); });
