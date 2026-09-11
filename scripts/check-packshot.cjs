// Run with: node scripts/check-packshot.cjs
// Offline contracts: real prompt/size/route code, mocked provider and auth calls.
// No credential files are loaded; each module sees an empty environment.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
let checks = 0;
const plain = (value) => JSON.parse(JSON.stringify(value));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP9sAAAAASUVORK5CYII=';

function loader(overrides = {}) {
  const cache = {};
  function load(file) {
    file = path.resolve(root, file);
    if (!path.extname(file)) file += '.ts';
    if (cache[file]) return cache[file].exports;
    const mod = { exports: {} };
    cache[file] = mod;
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const req = (name) => {
      if (Object.hasOwn(overrides, name)) return overrides[name];
      if (name === 'server-only') return {};
      if (name === 'next/server') return { NextResponse: { json: (data, init) => Response.json(data, init) } };
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      throw new Error('Unmocked import forbidden: ' + name);
    };
    vm.runInNewContext(code, {
      require: req, module: mod, exports: mod.exports, process: { env: {} },
      console, Buffer, URL, Request, Response, Headers, TextDecoder, TextEncoder,
      fetch: async () => { throw new Error('Unmocked network call forbidden'); },
    }, { filename: file });
    return mod.exports;
  }
  return load;
}

const load = loader();
const lib = load('src/lib/packshot.ts');
const models = load('src/lib/models.ts');
const support = (id) => models.MODELS[id].outputSizes;
async function check(name, fn) {
  await fn();
  checks++;
  console.log('PASS ' + name);
}

function harness(options = {}) {
  const state = { calls: [], spends: 0 };
  const provider = (kind) => async (input) => {
    state.calls.push({ kind, input });
    return { dataUrl: png, url: 'https://example.test/mock-output.png' };
  };
  const post = loader({
    '@/lib/models': {
      ...models, hasGeminiKey: () => options.key !== false,
      hasFalKey: () => options.key !== false, hasRecraftKey: () => options.key !== false,
      isDryRun: () => options.dry === true,
    },
    '@/lib/auth': {
      unlocked: () => options.unlocked !== false,
      consume: () => { state.spends++; return { ok: options.budget !== false, cookie: 'test-only=1' }; },
      liveJson: (spend, data) => Response.json(data, { headers: { 'set-cookie': spend.cookie } }),
    },
    '@/lib/gemini': {
      generateImage: provider('gemini'),
      dataUrlToInline: (url) => ({ mimeType: url.split(';')[0].slice(5), data: url.split(',')[1] }),
    },
    '@/lib/fal': { falGenerateImage: provider('fal') },
    '@/lib/recraft': { recraftImageToImage: provider('recraft') },
  })('src/app/api/packshot/route.ts').POST;
  return {
    state,
    async request(body, headers = {}) {
      const response = await post(new Request('https://local.test/api/packshot', {
        method: 'POST', headers: { 'content-type': 'application/json', ...headers },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }));
      return { response, json: await response.json() };
    },
  };
}

const valid = { targetAngle: 'front', modelId: 'nano-banana-pro', references: [{ angle: 'front', dataUrl: png }] };

async function main() {
  await check('hero coverage requires front, right and top; left does not count', () => {
    assert.deepEqual(plain(lib.getCoverage('hero34', ['front'])), {
      status: 'partial', required: ['front', 'right', 'top'], covered: ['front'], missing: ['right', 'top'],
    });
    assert.equal(lib.getCoverage('hero34', ['left']).status, 'missing');
    assert.equal(lib.isGrounded('hero34', ['front', 'left', 'right']), false);
    assert.equal(lib.isGrounded('hero34', ['front', 'right', 'top']), true);
    assert.equal(lib.isGrounded('hero34', ['hero34']), true);
  });
  await check('explicit visible faces override camera labels and combine across photos', () => {
    assert.equal(lib.isGrounded('hero34', [{ angle: 'hero34', visibleFaces: ['front'] }]), false);
    assert.equal(lib.isGrounded('front', [{ angle: 'front', visibleFaces: [] }]), false);
    assert.equal(lib.isGrounded('hero34', [{ angle: 'front', visibleFaces: ['front', 'right'] }, { angle: 'top' }]), true);
    assert.equal(lib.isGrounded('back', ['front', 'hero34']), false);
  });
  await check('prompt binds each reference to its faces and names only missing evidence', () => {
    const prompt = lib.buildPackshotPrompt('hero34', [{ angle: 'front', visibleFaces: ['front', 'right'] }], { format: 'carton' });
    assert.match(prompt, /image 1 shows front, right/);
    assert.match(prompt, /Missing reference evidence for these visible faces: top/);
    assert.match(prompt, /carton/);
    assert.doesNotMatch(lib.buildPackshotPrompt('hero34', ['hero34']), /Missing reference/);
  });
  await check('4K primary is translated to Seedream 4K and legacy IDs retain meaning', () => {
    assert.deepEqual(plain(lib.sizeRequestForModel(support('seedream-4'), 4096)), { sizePresetId: 'auto_4K', sizePx: 4096 });
    assert.equal(lib.resolveSize(support('seedream-4'), { presetId: '4K' }).px, 4096);
    assert.equal(lib.resolveSize(support('nano-banana-pro'), { presetId: 'auto_4K' }).presetId, '4K');
    assert.equal(lib.resolveSize(support('seedream-4'), { presetId: 'auto_2K', px: 4096 }).px, 4096);
  });
  await check('size limits are disclosed and each provider estimate uses its resolved size', () => {
    const gpt = lib.resolveSize(support('gpt-image-2-edit'), { px: 4096 });
    assert.equal(gpt.px, 2048);
    assert.match(gpt.note, /4096px.*2048px/);
    assert.equal(lib.resolveSize(support('gpt-image-2-edit'), { px: 1555 }).px, 1552);
    assert.match(lib.resolveSize(support('nano-banana-flash'), { px: 4096 }).note, /does not take an output size/);
    assert.match(lib.resolveSize(support('nano-banana-pro'), { presetId: 'not-real' }).note, /Unknown/);
    assert.equal(models.estimateCost('gpt-image-2-edit', { referenceImages: 2, sizePresetId: gpt.presetId, sizePx: gpt.px }), 0.55);
  });
  for (const mode of [{ dry: true }, { key: false }, { unlocked: false }, { budget: false }]) {
    await check('demo/auth gate keeps generation free: ' + JSON.stringify(mode), async () => {
      const h = harness(mode);
      const { response, json } = await h.request({ ...valid, targetAngle: 'hero34', sizePx: 4096 });
      assert.equal(response.status, 200);
      assert.equal(json.mock, true);
      assert.equal(json.cost, 0);
      assert.equal(json.grounded, false);
      assert.equal(json.coverage.status, 'partial');
      assert.equal(json.renderedPx, 4096);
      assert.equal(h.state.calls.length, 0);
      assert.equal(h.state.spends, mode.budget === false ? 1 : 0);
    });
  }
  await check('live Gemini keeps all same-angle references and bills once', async () => {
    const h = harness();
    const { response, json } = await h.request({
      ...valid, targetAngle: 'hero34', sizePx: 4096,
      references: [
        { angle: 'front', dataUrl: png, id: 'panel', name: 'Front and side', visibleFaces: ['front', 'right'] },
        { angle: 'front', dataUrl: png, id: 'top', name: 'Upper detail', visibleFaces: ['top'] },
      ],
    });
    assert.equal(json.grounded, true);
    assert.equal(json.coverage.status, 'full');
    assert.equal(h.state.calls[0].input.referenceImages.length, 2);
    assert.equal(h.state.calls[0].input.imageSize, '4K');
    assert.equal(json.cost, 0.268);
    assert.equal(h.state.spends, 1);
    assert.equal(response.headers.get('set-cookie'), 'test-only=1');
  });
  await check('live Seedream receives its 4K enum, not primary tier or fallback 2K', async () => {
    const h = harness();
    const { json } = await h.request({ ...valid, modelId: 'seedream-4', sizePresetId: '4K' });
    assert.equal(h.state.calls[0].input.sizePreset, 'auto_4K');
    assert.equal(json.renderedPx, 4096);
    assert.equal(json.cost, 0.03);
  });
  await check('live pixel and Recraft requests use resolved dimensions and disclose clamping', async () => {
    for (const id of ['gpt-image-2-edit', 'recraft-v4.1-utility']) {
      const h = harness();
      const { json } = await h.request({ ...valid, modelId: id, sizePx: 4096 });
      assert.match(json.sizeNote, /4096px/);
      if (id === 'gpt-image-2-edit') {
        assert.deepEqual(plain(h.state.calls[0].input.sizePixels), { width: 2048, height: 2048 });
        assert.equal(json.cost, 0.541);
      } else {
        assert.equal(h.state.calls[0].input.size, '1024x1024');
        assert.equal(h.state.calls[0].input.imageDataUrl, png);
        assert.equal(json.strength, 0.35);
      }
    }
  });
  const malformed = [
    ['invalid JSON', '{'], ['array body', []], ['null body', null],
    ['unknown target', { ...valid, targetAngle: 'diagonal' }],
    ['unknown model', { ...valid, modelId: 'arbitrary-endpoint' }],
    ['missing references', { ...valid, references: [] }],
    ['nonarray references', { ...valid, references: {} }],
    ['unknown reference angle', { ...valid, references: [{ angle: 'sideways', dataUrl: png }] }],
    ['remote reference URL', { ...valid, references: [{ angle: 'front', dataUrl: 'https://example.test/image.png' }] }],
    ['SVG reference', { ...valid, references: [{ angle: 'front', dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }] }],
    ['false PNG header', { ...valid, references: [{ angle: 'front', dataUrl: 'data:image/png;base64,AAAA' }] }],
    ['broken base64', { ...valid, references: [{ angle: 'front', dataUrl: 'data:image/png;base64,a%' }] }],
    ['hero is not a face', { ...valid, references: [{ angle: 'front', dataUrl: png, visibleFaces: ['hero34'] }] }],
    ['duplicate face tags', { ...valid, references: [{ angle: 'front', dataUrl: png, visibleFaces: ['front', 'front'] }] }],
    ['name is not text', { ...valid, references: [{ angle: 'front', dataUrl: png, name: 123 }] }],
    ['malformed brief', { ...valid, brief: { format: 123 } }],
    ['oversize notes', { ...valid, productNotes: 'x'.repeat(4001) }],
    ['noninteger pixels', { ...valid, sizePx: 1024.5 }],
    ['negative pixels', { ...valid, sizePx: -10 }],
    ['unknown preset', { ...valid, sizePresetId: 'unknown-size' }],
    ['global count overflow is rejected, not sliced', { ...valid, modelId: 'gpt-image-2-edit', references: Array(17).fill(valid.references[0]) }],
    ['provider count overflow is rejected', { ...valid, modelId: 'recraft-v4.1-utility', references: Array(2).fill(valid.references[0]) }],
  ];
  for (const [name, body] of malformed) {
    await check('malformed input rejects before spending: ' + name, async () => {
      const h = harness();
      const { response, json } = await h.request(body);
      assert.equal(response.status, 400, JSON.stringify(json));
      assert.equal(h.state.calls.length, 0);
      assert.equal(h.state.spends, 0);
    });
  }
  await check('per-image decoded byte limit is enforced before spending', async () => {
    const h = harness();
    const huge = 'data:image/png;base64,' + Buffer.alloc(lib.MAX_PACKSHOT_REFERENCE_BYTES + 1).toString('base64');
    const { response } = await h.request({ ...valid, references: [{ angle: 'front', dataUrl: huge }] });
    assert.equal(response.status, 413);
    assert.equal(h.state.spends, 0);
  });
  await check('serialized base64 body is bounded even with a false Content-Length', async () => {
    const h = harness();
    const body = JSON.stringify({ ...valid, ignored: 'é'.repeat(lib.MAX_PACKSHOT_BODY_BYTES / 2) });
    assert(body.length < lib.MAX_PACKSHOT_BODY_BYTES, 'UTF-8 byte count must detect what character count misses');
    const { response } = await h.request(body, { 'content-length': '10' });
    assert.equal(response.status, 413);
    assert.equal(h.state.spends, 0);
    assert.equal(h.state.calls.length, 0);
  });
  console.log(`\n${checks} packshot contract checks passed; no network or paid generation calls.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
