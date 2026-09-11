// Exercises real Campaign Studio callbacks and request snapshots. Every provider is intercepted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { harness, deferred } = require('./check-campaign-handoff.cjs');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let count = 0;
function check(label, run) { run(); count++; }
function load(file, overrides = {}, globals = {}) {
  const cache = {};
  function read(filename) {
    filename = path.resolve(root, filename); if (!path.extname(filename)) filename += '.ts';
    if (cache[filename]) return cache[filename].exports;
    const module = { exports: {} }; cache[filename] = module;
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, console, URL, Blob, Request, Response, AbortSignal, Image: class {}, ...globals, fetch: globals.fetch ?? function fetch() { throw new Error('Unmocked network forbidden'); }, require(name) { if (name in overrides) return overrides[name]; return name.startsWith('.') ? read(path.resolve(path.dirname(filename), name)) : name.startsWith('@/') ? read('src/' + name.slice(2)) : require(name); } }, { filename });
    return module.exports;
  }
  return read(file);
}
const helpers = load('src/lib/campaignWorkspace.ts');
const original = 'data:image/png;base64,b3JpZ2luYWw=';
const hero = 'data:image/png;base64,YXBwcm92ZWQ=';
function draft() { const d = helpers.veluneCampaignDraft(); d.workflow = 'batch'; d.exactText = false; d.imageDataUrl = original; d.step = 'deliverables'; d.selected = Object.fromEntries(Object.keys(d.selected).map((id) => [id, id === 'hero_still'])); return d; }
function mount(initial = draft(), options = {}) {
  const calls = [], writes = [], assets = [];
  const project = { id: 'project-one', name: 'Test campaign', drafts: initial ? { campaign: initial } : {}, assets: [], ...options.project };
  const workspace = { ready: true, project, saveDraft: async (tool, data) => { if (options.failSave) throw new Error('Storage full'); writes.push({ projectId: project.id, tool, data: structuredClone(data) }); }, saveAsset: async (asset) => assets.push(asset) };
  const screen = harness('src/app/ai-studio/studio/StudioWizard.tsx', 'StudioWizard', {}, {
    overrides: {
      '@/components/studio/StudioProjectProvider': { useStudioProject: () => workspace },
      '@/lib/campaignReferenceImage': { prepareCampaignReference: async () => 'data:image/png;base64,cHJlcGFyZWQ=' },
      ...(options.overrides ?? {}),
    },
    // Advance polling delays only; autosave timing is tested through durable explicit writes here.
    setTimeout: (fn, ms) => ms === 12000 ? setTimeout(fn, 0) : setTimeout(fn, ms),
    fetch: async (url, init) => {
      calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
      if (url === '/api/generate/image' || url === '/api/generate/video') assert(writes.some((write) => write.data.jobs?.some((job) => job.status === 'running')), 'intent must be durable before paid POST');
      if (options.fetch) return options.fetch(url, init);
      return Response.json({ mock: false, imageDataUrl: hero, cost: 0.15, prompt: 'submitted prompt' });
    },
  });
  return { screen, calls, writes, assets, workspace };
}

(async () => {
  check('malformed draft is rejected', () => assert.equal(helpers.readCampaignDraft({ schema: 'unknown' }), null));
  const clean = helpers.readCampaignDraft(draft());
  check('valid brief survives draft hydration', () => assert.equal(clean.brief.productName, 'VELUNE · concept study'));
  check('mock hero is not an approvable production asset', () => assert.equal(helpers.isRealHero({ deliverableId: 'hero_still', status: 'mock', imageDataUrl: hero }), false));
  check('unsafe remote URL is routed only through bounded media endpoint', () => assert.match(helpers.campaignDownloadSource('https://example.test/image.png', 'image'), /^\/api\/campaign\/file\?/));

  const untouched = mount(); await untouched.screen.settle();
  check('loading a saved campaign posts nothing', () => assert.equal(untouched.calls.length, 0));
  untouched.screen.unmount();
  const example = mount(null, { project: { example: 'velune' } }); await example.screen.settle();
  check('VELUNE example loads editable brief without generation', () => { assert(example.screen.named('BriefStep')); assert.equal(example.calls.length, 0); assert.match(example.screen.text(), /not final approved/); });
  example.screen.unmount();

  const editable = draft(); editable.step = 'brief';
  const leaving = mount(editable); await leaving.screen.settle();
  leaving.screen.named('BriefStep').props.setBrief((prior) => ({ ...prior, headlineEN: 'First quick edit' })); leaving.screen.render();
  leaving.screen.named('BriefStep').props.setBrief((prior) => ({ ...prior, headlineEN: 'Latest quick edit' })); leaving.screen.render();
  check('short debounce has not yet saved immediately after editing', () => assert.equal(leaving.writes.length, 0));
  leaving.screen.unmount(); await new Promise(setImmediate);
  check('unmount flushes latest committed edit before debounce expires', () => { assert.equal(leaving.writes.at(-1).data.brief.headlineEN, 'Latest quick edit'); assert.equal(leaving.writes.at(-1).projectId, 'project-one'); assert.equal(leaving.calls.length, 0); });

  const switchingDraft = mount(editable); await switchingDraft.screen.settle();
  switchingDraft.screen.named('BriefStep').props.setBrief((prior) => ({ ...prior, headlineEN: 'Original project final edit' })); switchingDraft.screen.render();
  const secondDraft = draft(); secondDraft.step = 'brief'; secondDraft.brief.headlineEN = 'Other project copy';
  switchingDraft.workspace.project = { id: 'project-two', name: 'Other', drafts: { campaign: secondDraft }, assets: [] };
  switchingDraft.workspace.saveDraft = async (tool, data) => switchingDraft.writes.push({ projectId: 'project-two', tool, data: structuredClone(data) });
  switchingDraft.screen.render({}); await switchingDraft.screen.settle();
  check('switch flush uses writer captured for original project', () => { const first = switchingDraft.writes.find((write) => write.projectId === 'project-one'); assert.equal(first.data.brief.headlineEN, 'Original project final edit'); assert(!switchingDraft.writes.some((write) => write.projectId === 'project-two' && write.data.brief?.headlineEN === 'Original project final edit')); });
  switchingDraft.screen.unmount(); await new Promise(setImmediate);
  check('second project unmount saves only its own draft', () => assert.equal(switchingDraft.writes.at(-1).data.brief.headlineEN, 'Other project copy'));

  const pending = deferred(); const once = mount(draft(), { fetch: () => pending.promise }); await once.screen.settle();
  const trigger = once.screen.named('DeliverablesStep').props.onGenerate;
  trigger(); trigger(); await once.screen.settle();
  check('double Generate click buys one request', () => assert.equal(once.calls.length, 1));
  check('request includes immutable original source snapshot', () => assert.equal(once.calls[0].body.imageDataUrl, original));
  pending.resolve(Response.json({ imageDataUrl: hero, prompt: 'real prompt', cost: 0.1 })); await once.screen.settle();
  check('completed still and source snapshot are durably retained', () => { const saved = once.writes.at(-1).data; assert.equal(saved.jobs[0].status, 'done'); assert.equal(saved.snapshots[saved.jobs[0].snapshotId].imageDataUrl, original); assert.equal(once.assets.length, 1); });
  once.screen.unmount();

  const blocked = mount(draft(), { failSave: true }); await blocked.screen.settle(); blocked.screen.named('DeliverablesStep').props.onGenerate(); await blocked.screen.settle();
  check('failed durable save prevents every paid POST', () => { assert.equal(blocked.calls.length, 0); assert.match(blocked.screen.text(), /Storage full/); }); blocked.screen.unmount();

  const videoDraft = draft(); videoDraft.selected.hero_still = false; videoDraft.selected.hero_video = true;
  let polls = 0;
  const video = mount(videoDraft, { fetch: async (url) => url === '/api/generate/video' ? Response.json({ provider: 'fal', falRequestId: 'request-12345678', prompt: 'video prompt', cost: 1 }) : ++polls < 3 ? Response.json({ error: 'temporarily unavailable' }, { status: 503 }) : Response.json({ status: 'done', videoUrl: 'https://v3.fal.media/test.mp4' }) });
  await video.screen.settle(); video.screen.named('DeliverablesStep').props.onGenerate();
  for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 3)); await video.screen.settle(); }
  check('two status errors never submit another video', () => { assert.equal(video.calls.filter((c) => c.url === '/api/generate/video').length, 1); assert.equal(polls, 3); });
  check('accepted video receipt saved before status polling', () => assert(video.writes.some((write) => write.data.jobs.some((job) => job.receipt?.falRequestId === 'request-12345678'))));
  const savedVideo = structuredClone(video.writes.at(-1).data); savedVideo.jobs[0].status = 'polling'; delete savedVideo.jobs[0].videoUrl;
  video.screen.unmount();
  const recovered = mount(savedVideo, { fetch: async () => Response.json({ status: 'done', videoUrl: 'https://v3.fal.media/recovered.mp4' }) }); await recovered.screen.settle();
  check('reload offers recovery without automatic polling or buying', () => { assert.equal(recovered.calls.length, 0); assert.equal(recovered.screen.named('CampaignResults').props.jobs[0].status, 'recoverable'); });
  const results = recovered.screen.named('CampaignResults'); results.props.onRecover(results.props.jobs[0]); await recovered.screen.settle();
  check('Check result reads saved handle only', () => { assert.deepEqual(recovered.calls.map((c) => c.url), ['/api/campaign/status']); assert.equal(recovered.writes.at(-1).data.jobs[0].status, 'done'); }); recovered.screen.unmount();

  const uncertain = mount(draft(), { fetch: async () => Response.json({ error: 'Connection was interrupted' }, { status: 503 }) }); await uncertain.screen.settle(); uncertain.screen.named('DeliverablesStep').props.onGenerate(); await uncertain.screen.settle();
  check('ambiguous submit becomes uncertain, not an automatic retry', () => { assert.equal(uncertain.calls.length, 1); assert.equal(uncertain.screen.named('CampaignResults').props.jobs[0].status, 'uncertain'); }); uncertain.screen.unmount();

  const retryDraft = draft(); retryDraft.step = 'generating'; retryDraft.snapshots.old = { id: 'old', brief: retryDraft.brief, imageDataUrl: original, exactText: false };
  retryDraft.jobs = [{ id: 'failed-one', deliverableId: 'hero_still', modelId: 'nano-banana-pro', snapshotId: 'old', status: 'failed', cost: 0 }];
  const retry = mount(retryDraft); await retry.screen.settle(); const retryProps = retry.screen.named('CampaignResults').props;
  retryProps.onRetry(retryProps.jobs[0]); await retry.screen.settle();
  check('selective retry adds one attempt and preserves prior history', () => { assert.equal(retry.calls.length, 1); assert.equal(retry.writes.at(-1).data.jobs.length, 2); assert.equal(retry.writes.at(-1).data.jobs[0].id, 'failed-one'); }); retry.screen.unmount();

  const lateResult = deferred(); const switching = mount(draft(), { fetch: () => lateResult.promise }); await switching.screen.settle();
  switching.screen.named('DeliverablesStep').props.onGenerate(); await switching.screen.settle();
  switching.workspace.project = { id: 'project-two', name: 'Another project', drafts: {}, assets: [] }; switching.screen.render({}); await switching.screen.settle();
  lateResult.resolve(Response.json({ imageDataUrl: hero, prompt: 'original project result', cost: 0.1 })); await switching.screen.settle();
  check('late result cannot replace a newly selected project UI', () => { assert(switching.screen.named('UploadStep')); assert(!switching.screen.named('CampaignResults')); }); switching.screen.unmount();

  const directed = draft(); directed.workflow = 'hero'; directed.approvedHeroId = 'hero-1'; directed.selected.hero_still = false; directed.selected.adapt_story = true;
  directed.snapshots.seed = { id: 'seed', brief: directed.brief, imageDataUrl: original, exactText: false };
  directed.jobs = [{ id: 'hero-1', deliverableId: 'hero_still', modelId: 'nano-banana-pro', snapshotId: 'seed', status: 'done', imageDataUrl: hero, cost: 0.15 }];
  const adapted = mount(directed); await adapted.screen.settle(); adapted.screen.named('DeliverablesStep').props.onGenerate(); await adapted.screen.settle();
  check('adaptation sends actual approved hero rather than original product', () => { assert.equal(adapted.calls[0].body.imageDataUrl, hero); assert.equal(adapted.calls[0].body.approvedHero, true); assert.equal(adapted.calls[0].body.deliverableId, 'adapt_story'); });
  check('original hero remains in result history', () => assert.equal(adapted.writes.at(-1).data.jobs[0].id, 'hero-1')); adapted.screen.unmount();

  const bilingual = structuredClone(directed); bilingual.exactText = true; bilingual.selected.adapt_story = false; bilingual.selected.promo_tile_en = bilingual.selected.promo_tile_fr = true;
  const layouts = [];
  const exact = mount(bilingual, { overrides: { '@/lib/campaignWorkspace': { ...helpers, renderCampaignTextTile: async (source, overlay) => { layouts.push({ source, overlay }); return hero; } } } });
  await exact.screen.settle(); exact.screen.named('DeliverablesStep').props.onGenerate(); await exact.screen.settle();
  check('exact bilingual layouts make no provider calls', () => { assert.equal(exact.calls.length, 0); assert.equal(layouts.length, 2); });
  check('EN and FR use identical approved pixels and exact supplied strings', () => { assert(layouts.every((layout) => layout.source === hero)); assert.deepEqual(layouts.map((layout) => layout.overlay.text).sort(), [bilingual.brief.headlineEN, bilingual.brief.headlineFR].sort()); }); exact.screen.unmount();
  const portable = structuredClone(savedVideo); portable.jobs[0].status = 'recoverable'; portable.jobs[0].receipt = { provider: 'fal', modelId: portable.jobs[0].modelId };
  check('portable receipt without handle becomes uncertain and cannot pretend to resume', () => assert.equal(helpers.readCampaignDraft(portable).jobs[0].status, 'uncertain'));
  portable.jobs[0].status = 'interrupted';
  check('imported interrupted attempts remain visible for review', () => assert.equal(helpers.readCampaignDraft(portable).jobs[0].status, 'uncertain'));

  let statusCalls = 0;
  const statusRoute = load('src/app/api/campaign/status/route.ts', {
    '@/lib/fal': { falPollVideo: async () => { statusCalls++; throw new Error('temporary provider outage'); } },
    '@/lib/gemini': { pollVeo: async () => { throw new Error('Wrong provider'); } },
    '@/lib/models': { getModel: () => ({ provider: 'fal', endpoint: 'test-endpoint' }) },
  });
  const statusResponse = await statusRoute.POST(new Request('https://example.test/api/campaign/status', { method: 'POST', body: JSON.stringify({ provider: 'fal', modelId: 'seedance-2.5', falRequestId: 'valid-handle-1234' }) }));
  check('status route reports transport outage as 503, not failed generation', () => { assert.equal(statusResponse.status, 503); assert.equal(statusCalls, 1); });
  const invalidStatus = await statusRoute.POST(new Request('https://example.test/api/campaign/status', { method: 'POST', body: JSON.stringify({ provider: 'fal', modelId: 'seedance-2.5', falRequestId: '../../wrong' }) }));
  check('invalid receipt never reaches provider status adapter', () => { assert.equal(invalidStatus.status, 400); assert.equal(statusCalls, 1); });
  let mediaFetches = 0;
  const fileRoute = load('src/app/api/campaign/file/route.ts', {}, { fetch: async () => { mediaFetches++; return new Response('', { status: 302, headers: { location: 'http://127.0.0.1/private' } }); } });
  const invalidFile = await fileRoute.GET(new Request('https://example.test/api/campaign/file?url=' + encodeURIComponent('https://fal.media.attacker.test/file.png')));
  check('media proxy rejects host suffix spoofing before fetch', () => { assert.equal(invalidFile.status, 400); assert.equal(mediaFetches, 0); });
  const redirectFile = await fileRoute.GET(new Request('https://example.test/api/campaign/file?url=' + encodeURIComponent('https://v3.fal.media/file.png')));
  check('media proxy rejects off-allowlist redirects without following them', () => { assert.equal(redirectFile.status, 502); assert.equal(mediaFetches, 1); });
  const streamRoute = load('src/app/api/campaign/file/route.ts', {}, { ReadableStream, fetch: async () => new Response(new Uint8Array(6 * 1024 * 1024), { headers: { 'content-type': 'video/mp4' } }) });
  const streamed = await streamRoute.GET(new Request('https://example.test/api/campaign/file?kind=video&url=https://v3.fal.media/large.mp4'));
  const streamedBytes = await streamed.arrayBuffer();
  check('valid media larger than buffered response limit is streamed intact', () => { assert.equal(streamed.status, 200); assert.equal(streamedBytes.byteLength, 6 * 1024 * 1024); assert.equal(streamed.headers.get('content-length'), null); });
  let sent = 0, stopped = false;
  const boundedRoute = load('src/app/api/campaign/file/route.ts', {}, { ReadableStream, fetch: async () => new Response(new ReadableStream({pull(controller) { if (sent++ < 26) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close(); }, cancel() { stopped = true; }}), { headers: { 'content-type': 'image/png' } }) });
  const bounded = await boundedRoute.GET(new Request('https://example.test/api/campaign/file?url=https://v3.fal.media/oversized.png'));
  await assert.rejects(() => bounded.arrayBuffer(), /size limit/);
  check('unknown-length oversized media aborts and cancels upstream', () => assert(stopped));
  console.log(`PASS: ${count} campaign workspace checks. Real UI callbacks; provider calls mocked, no credentials or paid requests.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
