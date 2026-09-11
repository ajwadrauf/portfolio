// Offline checks of the real producer card and Campaign intake callbacks.
// IndexedDB transport is covered separately. No provider or network is contacted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
let checks = 0;
const check = (label, fn) => { fn(); checks++; };
const pause = () => new Promise(setImmediate);
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === 'object' ? [node, ...walk(node.props?.children)] : [];
const textOf = (node) => Array.isArray(node) ? node.map(textOf).join(' ') : node && typeof node === 'object' ? textOf(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';

function harness(file, exportName, props = {}, options = {}) {
  const states = [], effects = [];
  let cursor = 0, dirty = true, tree, mounted = true;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const hooks = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [states[slot], (update) => { const value = typeof update === 'function' ? update(states[slot]) : update; if (!Object.is(value, states[slot])) { states[slot] = value; dirty = true; } }];
    },
    useRef(initial) { const slot = cursor++; if (!(slot in states)) states[slot] = { current: initial }; return states[slot]; },
    useMemo(fn, deps) { const slot = cursor++; if (!states[slot] || !same(states[slot].deps, deps)) states[slot] = { deps, value: fn() }; return states[slot].value; },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const slot = cursor++; if (!effects[slot] || !same(effects[slot].deps, deps)) effects[slot] = { deps, fn, pending: true, cleanup: effects[slot]?.cleanup }; },
  };
  const marker = () => null;
  const storage = new Map();
  const location = { href: options.href ?? 'https://example.test/ai-studio/studio' };
  Object.defineProperty(location, 'origin', { get: () => new URL(location.href).origin });
  const revoked = [], objectUrls = [];
  class TestURL extends URL {
    static createObjectURL(blob) { const url = `blob:test-${objectUrls.length + 1}`; objectUrls.push({ blob, url }); return url; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const overrides = {
    react: hooks,
    'next/dynamic': () => marker,
    '@/components/packshots/CampaignHandoffButton': { CampaignHandoffButton: marker },
    '@/lib/useHealth': { useHealth: () => ({ health: { live: true, gemini: true, fal: true } }) },
    ...options.overrides,
  };
  const cache = {};
  function load(name) {
    const absolute = path.resolve(root, name);
    let actual = absolute;
    if (!fs.existsSync(actual)) actual = fs.existsSync(actual + '.ts') ? actual + '.ts' : actual + '.tsx';
    if (actual.endsWith('.css')) return {};
    if (cache[actual]) return cache[actual].exports;
    const mod = { exports: {} }; cache[actual] = mod;
    let source = fs.readFileSync(actual, 'utf8');
    // Private card stays private in production; expose it only inside this VM.
    if (actual === path.resolve(root, file) && exportName === 'PackshotCard') source += '\nexport { PackshotCard };\n';
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    function req(dependency) {
      if (Object.hasOwn(overrides, dependency)) return overrides[dependency];
      if (dependency === 'server-only') return {};
      if (dependency.startsWith('@/')) return load('src/' + dependency.slice(2));
      if (dependency.startsWith('.')) return load(path.resolve(path.dirname(actual), dependency));
      return require(require.resolve(dependency, { paths: [root] }));
    }
    vm.runInNewContext(code, {
      require: req, module: mod, exports: mod.exports, process: { env: {} }, console,
      Blob, File, Buffer, Error, URL: TestURL, crypto: require('node:crypto').webcrypto,
      Request, Response, Headers, AbortController, AbortSignal, setTimeout, clearTimeout,
      localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
      window: { location, open: options.open ?? (() => null), confirm: () => true, history: { state: null, replaceState: (_state, _title, url) => { location.href = new URL(url, location.href).href; } } },
      fetch: options.fetch ?? (async () => { throw new Error('Unmocked network call forbidden'); }),
    }, { filename: actual });
    return mod.exports;
  }
  const Component = load(file)[exportName];
  function render(nextProps) {
    if (nextProps) { props = nextProps; dirty = true; }
    for (let iterations = 0; dirty && mounted; iterations++) {
      assert(iterations < 25, 'Effects must settle');
      dirty = false; cursor = 0; tree = Component(props);
      for (const effect of effects) if (effect?.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.fn(); }
    }
    return tree;
  }
  render();
  return {
    render, nodes: () => walk(tree), text: () => textOf(tree), marker, revoked, objectUrls, location,
    named: (name) => walk(tree).find((node) => typeof node.type === 'function' && node.type.name === name),
    campaign: () => walk(tree).find((node) => node.type === marker),
    async settle() { for (let i = 0; i < 6; i++) { await pause(); render(); } },
    unmount() { mounted = false; for (const effect of effects) effect?.cleanup?.(); },
  };
}

function checkProducer() {
  const source = 'data:image/png;base64,aW1hZ2U=';
  const baseJob = { id: 'job-1', input: { sku: 'OLD-SKU', lang: 'en', references: [], brief: {} }, angle: 'front', modelId: 'nano-banana-flash', role: 'primary', status: 'done', imageDataUrl: source, cost: 0 };
  const props = (job) => ({ job, sku: job.input.sku, lang: job.input.lang, onInspect() {} });
  for (const status of ['queued', 'running', 'failed', 'mock']) {
    const card = harness('src/app/ai-studio/packshots/PackshotStudio.tsx', 'PackshotCard', props({ ...baseJob, status }));
    check(`${status} has no campaign CTA even if stale media is present`, () => assert(!card.campaign()));
  }
  const empty = harness('src/app/ai-studio/packshots/PackshotStudio.tsx', 'PackshotCard', props({ ...baseJob, imageDataUrl: undefined }));
  check('done with no media has no campaign CTA', () => assert(!empty.campaign()));
  const finishing = harness('src/app/ai-studio/packshots/PackshotStudio.tsx', 'PackshotCard', props({ ...baseJob, finishing: 'cutout' }));
  check('in-flight finishing has no campaign CTA', () => assert(!finishing.campaign()));
  const card = harness('src/app/ai-studio/packshots/PackshotStudio.tsx', 'PackshotCard', props(baseJob));
  check('original transfer matches the displayed original bytes', () => assert.equal(card.campaign().props.source, source));
  check('unreviewed generated original never claims approval', () => assert.equal(card.campaign().props.meta.review, 'needs-review'));
  const finishedJob = { ...baseJob, finished: { op: 'cutout', url: 'https://fal.media/finished.png' }, reviewedAt: '2026-09-10T12:00:00Z' };
  card.render(props(finishedJob));
  check('finished variant defaults to finished file with accurate label', () => { assert.equal(card.campaign().props.source, finishedJob.finished.url); assert.equal(card.campaign().props.meta.variant, 'Background removed'); });
  const select = card.nodes().find((node) => node.type === 'select');
  select.props.onChange({ target: { value: 'original' } }); card.render();
  check('choosing original switches bytes and provenance together', () => { assert.equal(card.campaign().props.source, source); assert.equal(card.campaign().props.meta.variant, 'Original generated image'); assert.equal(card.campaign().props.meta.reviewedAt, finishedJob.reviewedAt); });
  check('producer uses immutable submitted SKU', () => assert.match(card.campaign().props.meta.name, /OLD-SKU/));
}

async function checkReceiver() {
  const id = '05bdfe1e-5276-4d67-9a13-8eb67b9f2ee9';
  const blob = new Blob(['test PNG'], { type: 'image/png' });
  const record = { version: 1, id, createdAt: Date.now(), expiresAt: Date.now() + 86_400_000, blob, meta: { name: 'Selected packshot', angle: 'front', source: 'generated', variant: 'Original generated image', review: 'needs-review' } };
  const analysis = { productContext: { name: 'Ice cream', category: 'food', colors: ['white'], texture: 'matte', packagingType: 'box' }, questions: [{ id: 'mood', question: 'Mood?', options: ['Calm', 'Bright'], defaultAnswer: 'Calm' }] };
  function mount(options = {}) {
    const calls = [], prepared = [], loads = [];
    const screen = harness('src/app/ai-studio/studio/StudioWizard.tsx', 'StudioWizard', {}, {
      href: options.href ?? `https://example.test/ai-studio/studio?packshot=${id}`,
      overrides: {
        '@/lib/campaignHandoff': { validCampaignHandoffId: (value) => value === id, loadCampaignHandoff: async (value) => { loads.push(value); return options.load ? options.load(value) : record; } },
        '@/lib/campaignReferenceImage': { prepareCampaignReference: async (source) => { prepared.push(source); return options.prepare ? options.prepare(source) : 'data:image/jpeg;base64,cHJlcGFyZWQ='; } },
      },
      fetch: async (url, init) => { calls.push({ url, init }); return options.fetch ? options.fetch(url, init) : Response.json(analysis); },
    });
    return { screen, calls, prepared, loads };
  }
  const blank = mount({ href: 'https://example.test/ai-studio/studio' }); await blank.screen.settle();
  check('ordinary visit does not load a transfer or call any API', () => { assert.equal(blank.loads.length, 0); assert.equal(blank.calls.length, 0); });
  const ready = mount(); await ready.screen.settle();
  check('receiving a stored image performs no paid work or encoding', () => { assert.equal(ready.calls.length, 0); assert.equal(ready.prepared.length, 0); assert(ready.screen.named('ImportedPackshotCard')); });
  check('receiver preview is made from the exact transferred Blob', () => assert.equal(ready.screen.objectUrls[0].blob, blob));
  const staged = ready.screen.named('ImportedPackshotCard');
  const visibleCard = staged.type(staged.props);
  check('staged image offers a real explicit Analyze button and honest review status', () => { assert(walk(visibleCard).some((node) => node.type === 'button' && textOf(node) === 'Analyze this packshot →' && node.props.onClick === staged.props.onAnalyze)); assert.match(textOf(visibleCard), /Needs human review/); });
  const pending = deferred(); const submitted = mount({ fetch: () => pending.promise }); await submitted.screen.settle();
  const imported = submitted.screen.named('ImportedPackshotCard');
  imported.props.onAnalyze(); imported.props.onAnalyze(); await submitted.screen.settle();
  check('two immediate Analyze clicks submit once', () => { assert.equal(submitted.calls.length, 1); assert.equal(submitted.calls[0].url, '/api/analyze'); assert.equal(submitted.prepared.length, 1); assert.equal(submitted.prepared[0], blob); });
  check('analysis receives the separate prepared copy, not the original Blob or URL', () => assert.equal(JSON.parse(submitted.calls[0].init.body).imageDataUrl, 'data:image/jpeg;base64,cHJlcGFyZWQ='));
  pending.resolve(Response.json(analysis)); await submitted.screen.settle();
  check('successful explicit analysis advances to clarification without generating deliverables', () => { assert(submitted.screen.named('ClarifyStep')); assert.equal(submitted.calls.length, 1); });
  const failed = mount({ fetch: async () => Response.json({ error: 'Provider temporarily unavailable' }, { status: 503 }) }); await failed.screen.settle();
  failed.screen.named('ImportedPackshotCard').props.onAnalyze(); await failed.screen.settle(); await failed.screen.settle();
  check('analysis failure remains staged and never automatically retries', () => { assert.equal(failed.calls.length, 1); assert(failed.screen.named('ImportedPackshotCard')); assert.match(failed.screen.text(), /Provider temporarily unavailable/); });
  const preparationFailed = mount({ prepare: async () => { throw new Error('Unreadable image'); } }); await preparationFailed.screen.settle();
  preparationFailed.screen.named('ImportedPackshotCard').props.onAnalyze(); await preparationFailed.screen.settle();
  check('unreadable transfer never reaches a paid endpoint', () => { assert.equal(preparationFailed.calls.length, 0); assert(preparationFailed.screen.named('ImportedPackshotCard')); assert.match(preparationFailed.screen.text(), /Unreadable image/); });
  const briefPending = deferred(); const noQuestions = mount({ fetch: async (url) => url === '/api/analyze' ? Response.json({ ...analysis, questions: [] }) : briefPending.promise }); await noQuestions.screen.settle();
  const analyzeWithoutQuestions = noQuestions.screen.named('ImportedPackshotCard').props.onAnalyze;
  analyzeWithoutQuestions(); await noQuestions.screen.settle(); analyzeWithoutQuestions(); await noQuestions.screen.settle();
  check('Analyze remains single-flight through the existing zero-question brief branch', () => assert.deepEqual(noQuestions.calls.map((call) => call.url), ['/api/analyze', '/api/brief']));
  briefPending.resolve(Response.json({ brief: {} })); await noQuestions.screen.settle();
  const missing = mount({ load: async () => null }); await missing.screen.settle();
  check('expired or missing transfer stays recoverable with no paid call', () => { assert(!missing.screen.named('ImportedPackshotCard')); assert(missing.screen.named('UploadStep')); assert.match(missing.screen.text(), /no longer available/); assert.equal(missing.calls.length, 0); });
  const invalid = mount({ href: 'https://example.test/ai-studio/studio?packshot=untrusted' }); await invalid.screen.settle();
  check('invalid ID does not touch storage or providers', () => { assert.equal(invalid.loads.length, 0); assert.equal(invalid.calls.length, 0); assert.match(invalid.screen.text(), /incomplete or invalid/); });
  const unreadable = mount({ load: async () => { throw new Error('Storage unavailable'); } }); await unreadable.screen.settle();
  check('storage rejection keeps the normal upload fallback', () => { assert.equal(unreadable.calls.length, 0); assert(unreadable.screen.named('UploadStep')); assert.match(unreadable.screen.text(), /Storage unavailable/); });
  const slowRead = deferred(); const manual = mount({ load: () => slowRead.promise }); await manual.screen.settle();
  const manualBlob = new Blob(['new manual image'], { type: 'image/jpeg' });
  manual.screen.named('UploadStep').props.onFile(manualBlob); await manual.screen.settle();
  slowRead.resolve(record); await manual.screen.settle();
  check('manual choice wins over an older asynchronous transfer read', () => { assert(!manual.screen.named('ImportedPackshotCard')); assert.equal(manual.prepared[0], manualBlob); assert.equal(manual.calls.length, 1); assert(!manual.screen.location.href.includes('packshot=')); });
  const dismissed = mount(); await dismissed.screen.settle();
  dismissed.screen.named('ImportedPackshotCard').props.onDismiss(); await dismissed.screen.settle();
  check('dismissal clears URL and releases preview without spending', () => { assert(!dismissed.screen.named('ImportedPackshotCard')); assert.equal(dismissed.calls.length, 0); assert.equal(dismissed.screen.revoked.length, 1); assert(!dismissed.screen.location.href.includes('packshot=')); });
  const slowUnmount = deferred(); const gone = mount({ load: () => slowUnmount.promise }); await gone.screen.settle(); gone.screen.unmount(); slowUnmount.resolve(record); await pause();
  check('late transfer after unmount never creates a leaked preview URL', () => assert.equal(gone.screen.objectUrls.length, 0));
}

async function checkHandoffButton() {
  const props = { source: 'data:image/png;base64,b3JpZ2luYWw=', meta: { name: 'Packshot', angle: 'front', source: 'generated', variant: 'Original', review: 'needs-review' } };
  const id = '05bdfe1e-5276-4d67-9a13-8eb67b9f2ee9';
  function blankTab() {
    return { closed: false, opener: {}, document: { title: '', body: { textContent: '' } }, location: { href: 'about:blank', replace(href) { this.href = href; } }, close() { this.closed = true; } };
  }
  function mount(options = {}) {
    const pending = deferred(), saves = [], opens = [];
    const tab = options.blocked ? null : blankTab();
    const screen = harness('src/components/packshots/CampaignHandoffButton.tsx', 'CampaignHandoffButton', { ...props, ...options.props }, {
      open: (url, target) => { opens.push({ url, target }); return tab; },
      overrides: { '@/lib/campaignHandoff': { saveCampaignHandoff: (source, meta, settings) => { saves.push({ source, meta, settings }); return pending.promise; } } },
    });
    const click = () => screen.nodes().find((node) => node.type === 'button').props.onClick();
    return { screen, pending, saves, opens, tab, click };
  }
  const normal = mount();
  check('rendering a handoff CTA neither saves nor opens a tab', () => { assert.equal(normal.saves.length, 0); assert.equal(normal.opens.length, 0); });
  normal.click(); normal.click();
  check('double-click saves once and opens a single owned blank tab synchronously', () => { assert.equal(normal.saves.length, 1); assert.equal(normal.opens.length, 1); assert.equal(normal.opens[0].url, 'about:blank'); assert.equal(normal.tab.opener, null); assert.equal(normal.saves[0].source, props.source); });
  normal.pending.resolve({ id }); await normal.screen.settle();
  check('completed save navigates to the opaque ID and keeps a usable fallback link', () => { assert.equal(normal.tab.location.href, `https://example.test/ai-studio/studio?packshot=${id}`); const link = normal.screen.nodes().find((node) => node.type === 'a'); assert.equal(link.props.href, `/ai-studio/studio?packshot=${id}`); assert.equal(link.props.target, '_blank'); assert.match(link.props.rel, /noopener/); });
  const blocked = mount({ blocked: true }); blocked.click(); blocked.pending.resolve({ id }); await blocked.screen.settle();
  check('popup blocking retains an explicit link after saving', () => assert.equal(blocked.screen.nodes().find((node) => node.type === 'a').props.href, `/ai-studio/studio?packshot=${id}`));
  const changed = mount(); changed.click(); changed.screen.render({ ...props, source: 'data:image/png;base64,bmV3' });
  check('changing the selected source aborts the old save and closes only its blank tab', () => { assert(changed.saves[0].settings.signal.aborted); assert(changed.tab.closed); });
  changed.pending.resolve({ id }); await changed.screen.settle();
  check('late save for an old variant does not offer or navigate a stale handoff', () => { assert(!changed.screen.nodes().some((node) => node.type === 'a')); assert.equal(changed.tab.location.href, 'about:blank'); });
  const navigated = mount(); navigated.click(); navigated.tab.location.href = 'https://example.test/user-chosen-page'; navigated.screen.unmount();
  check('cleanup never closes a tab the user navigated elsewhere', () => { assert(navigated.saves[0].settings.signal.aborted); assert.equal(navigated.tab.closed, false); });
  navigated.pending.resolve({ id }); await pause();
  const unmounted = mount(); unmounted.click(); unmounted.screen.unmount();
  check('unmount aborts the pending save and closes its owned blank tab', () => { assert(unmounted.saves[0].settings.signal.aborted); assert(unmounted.tab.closed); });
  unmounted.pending.resolve({ id }); await pause();
  const failed = mount(); failed.click(); failed.pending.reject(new Error('Quota exceeded')); await failed.screen.settle();
  check('failed save leaves original workspace and an actionable error, with no empty tab', () => { assert(failed.tab.closed); assert.match(failed.screen.text(), /Quota exceeded/); assert(failed.screen.nodes().some((node) => node.type === 'button')); });
  const disabled = mount({ props: { disabled: true } }); disabled.click();
  check('disabled handoff blocks its handler as well as its control', () => { assert.equal(disabled.saves.length, 0); assert.equal(disabled.opens.length, 0); });
}

async function checkReferenceEncoder() {
  function encoder(options = {}) {
    const calls = [], urls = [], revoked = [], drawing = [];
    let decoded = 0;
    const ctx = { fillStyle: '', fillRect() { drawing.push({ operation: 'fill', color: this.fillStyle }); }, drawImage() { drawing.push({ operation: 'draw' }); } };
    const canvas = { width: 0, height: 0, getContext: () => ctx, toDataURL(type, quality) { const details = { width: this.width, height: this.height, type, quality }; calls.push(details); return options.encode ? options.encode(details) : 'data:image/jpeg;base64,c21hbGw='; } };
    class TestImage {
      naturalWidth = options.width ?? 4096;
      naturalHeight = options.height ?? 4096;
      set src(value) { decoded++; this.source = value; queueMicrotask(() => this.onload()); }
    }
    class TestURL extends URL {
      static createObjectURL(blob) { urls.push(blob); return 'blob:encoder'; }
      static revokeObjectURL(url) { revoked.push(url); }
    }
    const mod = { exports: {} };
    const file = path.join(root, 'src/lib/campaignReferenceImage.ts');
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module: mod, exports: mod.exports, Error, Blob, URL: TestURL, Image: TestImage, document: { createElement: () => canvas }, queueMicrotask }, { filename: file });
    return { ...mod.exports, calls, urls, revoked, drawing, decoded: () => decoded };
  }
  const source = new Blob(['source'], { type: 'image/png' });
  const standard = encoder(); await standard.prepareCampaignReference(source);
  check('4096px packshot starts at 2048px, preserving label detail', () => { assert.equal(standard.calls[0].width, 2048); assert.equal(standard.calls[0].height, 2048); assert.equal(standard.calls[0].quality, 0.92); });
  check('analysis copy flattens on white and releases only its own object URL', () => { assert.equal(standard.drawing[0].operation, 'fill'); assert.equal(standard.drawing[0].color, '#ffffff'); assert.equal(standard.drawing[1].operation, 'draw'); assert.equal(standard.calls[0].type, 'image/jpeg'); assert.deepEqual(standard.revoked, ['blob:encoder']); assert.equal(standard.urls[0], source); });
  const wide = encoder({ width: 4096, height: 2048 }); await wide.prepareCampaignReference(source);
  check('encoder keeps source aspect ratio', () => { assert.equal(wide.calls[0].width, 2048); assert.equal(wide.calls[0].height, 1024); });
  const oversized = 'data:image/jpeg;base64,' + 'A'.repeat(2_500_001);
  const tiered = encoder({ encode: ({ width }) => width >= 2048 ? oversized : 'data:image/jpeg;base64,c21hbGw=' }); await tiered.prepareCampaignReference(source);
  check('body budget exhausts quality options before lowering resolution', () => { assert.deepEqual(tiered.calls.slice(0, 3).map((call) => call.width), [2048, 2048, 2048]); assert.equal(tiered.calls[3].width, 1792); });
  const tooLarge = encoder(); let largeError;
  try { await tooLarge.prepareCampaignReference(new Blob([new Uint8Array(24 * 1024 * 1024 + 1)], { type: 'image/png' })); } catch (error) { largeError = error; }
  check('oversized source is rejected before image decode', () => { assert.match(largeError.message, /smaller than 24 MB/); assert.equal(tooLarge.decoded(), 0); });
  const unreadable = encoder({ width: 0 }); let dimensionError;
  try { await unreadable.prepareCampaignReference(source); } catch (error) { dimensionError = error; }
  check('invalid dimensions fail clearly and release the temporary object URL', () => { assert.match(dimensionError.message, /no readable dimensions/); assert.deepEqual(unreadable.revoked, ['blob:encoder']); });
  const neverFits = encoder({ encode: () => oversized }); let budgetError;
  try { await neverFits.prepareCampaignReference(source); } catch (error) { budgetError = error; }
  check('encoder refuses an over-budget payload after all supported tiers', () => { assert.match(budgetError.message, /could not fit/); assert.equal(neverFits.calls.length, 21); assert.deepEqual(neverFits.revoked, ['blob:encoder']); });
}

(async () => {
  checkProducer();
  await checkReceiver();
  await checkHandoffButton();
  await checkReferenceEncoder();
  console.log(`PASS: ${checks} campaign handoff checks; real UI callbacks, mocked storage/provider adapters, no host credentials or paid calls.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
