// Actual dialog handlers and generation entry points, with offline health/unlock responses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let checks = 0;
const check = (name, fn) => { fn(); checks++; };
const walk = node => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === 'object' ? [node, ...walk(node.props?.children)] : [];
const textOf = node => Array.isArray(node) ? node.map(textOf).join(' ') : node && typeof node === 'object' ? textOf(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
const locked = { live: false, gate: 'locked', remaining: null, ungated: false };
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function harness(deferHealth = false) {
  const slots = [], effects = [], requests = [], events = [];
  let cursor = 0, dirty = true, tree, responseHealth = { ...locked }, unlockStatus = 200, releaseHealth;
  const window = new EventTarget();
  for (const name of ['live-gate-open', 'live-mode-changed']) window.addEventListener(name, () => events.push(name));
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useCallback(fn) { return fn; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || deps.some((dep, j) => !Object.is(dep, effects[i].deps[j]))) effects[i] = { deps, fn, pending: true, cleanup: effects[i]?.cleanup }; },
  };
  // useCallback must keep stable identities so refresh effects behave like React.
  hooks.useCallback = (fn, deps) => { const i = cursor++; if (!slots[i] || deps.some((dep, j) => !Object.is(dep, slots[i].deps[j]))) slots[i] = { deps, fn }; return slots[i].fn; };
  const input = { focuses: 0, focus() { this.focuses++; } };
  const dialog = {
    open: false, shows: 0, closes: 0,
    showModal() { this.open = true; this.shows++; },
    close() { this.open = false; this.closes++; walk(tree).find(node => node.type === 'dialog')?.props.onClose(); },
  };
  const moduleCache = {};
  function load(file) {
    if (moduleCache[file]) return moduleCache[file].exports;
    const mod = { exports: {} }; moduleCache[file] = mod;
    vm.runInNewContext(compile(fs.readFileSync(path.join(root, file), 'utf8')), {
      module: mod, exports: mod.exports, Event, Error, TypeError, window,
      setInterval: () => 1, clearInterval() {},
      require(name) { if (name === 'react') return hooks; if (name === 'react/jsx-runtime') return require(name); if (name === '@/lib/useHealth') return load('src/lib/useHealth.ts'); throw new Error(`Unexpected import: ${name}`); },
      fetch: async (url, options = {}) => {
        requests.push({ url, ...options });
        if (url === '/api/health') {
          if (deferHealth) await new Promise(resolve => { releaseHealth = resolve; });
          return { json: async () => ({ ...responseHealth }) };
        }
        assert.equal(url, '/api/unlock', 'No generation endpoint may be called');
        if (options.method === 'DELETE') responseHealth = { ...locked };
        else if (unlockStatus === 200) responseHealth = { ...locked, live: true, gate: 'unlocked', remaining: 40 };
        return { ok: unlockStatus === 200, status: unlockStatus, json: async () => ({ ok: unlockStatus === 200 }) };
      },
    }, { filename: file });
    return mod.exports;
  }
  const health = load('src/lib/useHealth.ts'), component = load('src/components/LiveGate.tsx');
  function render() {
    for (let i = 0; dirty; i++) {
      assert(i < 30, 'No render loop'); dirty = false; cursor = 0; tree = component.LiveGate();
      for (const node of walk(tree)) {
        if (node.type === 'dialog') node.props.ref.current = dialog;
        if (node.type === 'input') node.props.ref.current = input;
      }
      for (const effect of effects) if (effect?.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.fn(); }
    }
  }
  const settle = async () => { for (let i = 0; i < 5; i++) { await new Promise(setImmediate); render(); } };
  const node = type => walk(tree).find(item => item.type === type);
  const button = label => walk(tree).find(item => item.type === 'button' && textOf(item).replace(/\s+/g, ' ').trim() === label);
  const setCode = code => { node('input').props.onChange({ target: { value: code } }); render(); };
  return { health, dialog, input, requests, events, render, settle, node, button, setCode, text: () => textOf(tree), setStatus: value => { unlockStatus = value; }, setHealth: value => { responseHealth = value; health.announceLiveModeChange(); }, release: () => { deferHealth = false; releaseHealth(); }, cleanup: () => effects.forEach(effect => effect?.cleanup?.()) };
}

function generationHandler(file, name, jsx = false) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) {
    if (!jsx && ts.isVariableDeclaration(node) && node.name.getText(ast) === name && ts.isCallExpression(node.initializer)) found = node.initializer.arguments[0].getText(ast);
    if (!jsx && ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast);
    if (jsx && ts.isJsxAttribute(node) && node.name.getText(ast) === name) found = node.initializer.expression.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert(found, `${name} exists in ${file}`);
  return (guard, globals = {}) => {
    const mod = { exports: {} };
    vm.runInNewContext(compile(`exports.run = (${found});`), { exports: mod.exports, requestUnlockForDemo: guard, health: locked, ...globals });
    return mod.exports.run;
  };
}

(async () => {
  const h = harness(); h.render(); await h.settle();
  check('a locked visitor is not interrupted merely by browsing', () => assert.equal(h.dialog.shows, 0));
  let submissions = 0;
  const attempt = () => { if (h.health.requestUnlockForDemo(locked)) return; submissions++; };
  attempt(); h.render();
  check('demo Generate opens the modal and stops submission', () => { assert(h.dialog.open); assert.equal(submissions, 0); assert.equal(h.input.focuses, 1); });
  check('dialog has accessible copy, responsive centering and no em dash', () => { assert.match(h.node('dialog').props.className, /fixed inset-0 m-auto/); assert.match(h.node('dialog').props.className, /100dvh/); assert.equal(h.node('dialog').props['aria-describedby'], 'live-gate-description'); assert.match(h.text(), /You're in demo mode/); assert(!h.text().includes('—')); });
  h.setCode('temporary-code'); h.button('Keep exploring').props.onClick(); h.render();
  check('dismissal clears passcode without starting a request', () => { assert(!h.dialog.open); assert.equal(h.node('input').props.value, ''); assert.equal(h.requests.filter(r => r.url !== '/api/health').length, 0); });
  h.button('Demo mode · Unlock').props.onClick(); h.render();
  check('the header control opens the same dialog', () => assert.equal(h.dialog.shows, 2));
  h.setStatus(401); h.setCode('incorrect-test-code'); await h.node('form').props.onSubmit({ preventDefault() {} }); h.render();
  check('incorrect passcode keeps dialog open with a useful error', () => { assert(h.dialog.open); assert.match(h.text(), /didn't match/); assert.equal(h.node('input').props['aria-invalid'], true); });
  h.setStatus(429); await h.node('form').props.onSubmit({ preventDefault() {} }); h.render();
  check('rate limit explains when to retry', () => assert.match(h.text(), /15 minutes/));
  h.setStatus(200); h.setCode('valid-local-test-code'); await h.node('form').props.onSubmit({ preventDefault() {} }); await h.settle();
  check('unlock closes the modal, clears the code and announces fresh mode', () => { assert(!h.dialog.open); assert.equal(h.node('input').props.value, ''); assert(h.button('Live · 40 left')); assert(h.events.includes('live-mode-changed')); });
  check('unlock never automatically starts generation', () => { assert.equal(submissions, 0); assert(h.requests.every(r => r.url === '/api/health' || r.url === '/api/unlock')); });
  const before = h.events.length;
  check('live, ungated demo and loading states do not request an unlock', () => {
    for (const value of [{ live: true, gate: 'unlocked' }, { live: true, gate: 'disabled' }, { live: false, gate: 'disabled' }, null]) assert.equal(h.health.requestUnlockForDemo(value), false);
    assert.equal(h.events.length, before);
  });
  h.setHealth({ ...locked, gate: 'exhausted', remaining: 0 }); await h.settle();
  assert(h.health.requestUnlockForDemo({ ...locked, gate: 'exhausted' })); h.render();
  check('used-up sessions ask for access with distinct copy', () => { assert(h.dialog.open); assert.match(h.text(), /back in demo mode/); assert.match(h.text(), /used its live runs/); });
  h.node('dialog').props.onCancel(); h.render();
  check('Escape closes the modal without submitting', () => assert(!h.dialog.open));
  h.health.requestLiveUnlock(); h.render(); h.node('dialog').props.onClick({ target: h.dialog }); h.render();
  check('backdrop click closes the modal', () => assert(!h.dialog.open));
  h.health.requestLiveUnlock(); h.render(); h.setHealth({ ...locked, live: true, gate: 'unlocked', remaining: 39 }); await h.settle();
  check('unlocking elsewhere closes an open stale prompt', () => assert(!h.dialog.open));
  const pending = harness(true); pending.render(); pending.health.requestLiveUnlock(); pending.render(); pending.release(); await pending.settle();
  check('an unlock request made before gate health loads is not lost', () => assert(pending.dialog.open));

  let gateCalls = 0;
  const guard = () => { gateCalls++; return true; };
  const pack = 'src/app/ai-studio/packshots/PackshotStudio.tsx';
  const ad = 'src/app/ai-studio/ads/AdLab.tsx';
  const cases = [
    ['Packshot Generate', generationHandler(pack, 'generate')(guard, { runLock: { current: false }, uploadLock: { current: false }, activeJobs: { current: new Set() }, uploading: false, references: [{}], selectedAngles: ['front'], overCap: false })],
    ['Packshot retry', generationHandler(pack, 'retryFailed')(guard, { runLock: { current: false }, activeJobs: { current: new Set() } })],
    ['Packshot finishing', () => generationHandler(pack, 'finish')(guard)({ status: 'done' }, 'upscale')],
    ['Ad Generate', generationHandler(ad, 'generate')(guard, { generateLock: { current: false }, hydrated: true, draftSaveBlocked: false })],
    ['Music Generate', generationHandler(ad, 'generateMusic')(guard)],
    ['Effect Generate', () => generationHandler(ad, 'generateSfx')(guard)('carton tick')],
    ['Voice Generate', () => generationHandler(ad, 'onVoice', true)(guard)({ text: 'Hello', voice: 'Rachel' }, 'Test voice')],
    ['Campaign Generate and retry', generationHandler('src/app/ai-studio/studio/StudioWizard.tsx', 'runGeneration')(guard, { generationLock: { current: false }, project: { id: 'test' }, hydratedId: 'test', brief: {} })],
  ];
  for (const [name, run] of cases) { const before = gateCalls; await run(); check(`${name} exits before mutating output or calling a provider`, () => assert.equal(gateCalls, before + 1)); }
  let takesChanged = 0, errors = 0, generating = false;
  const voice = generationHandler('src/components/studio/SoundPlanner.tsx', 'generateVoice')(() => true, { scene: { id: 'test', line: 'Hi', title: 'Hi' }, spec: 'test', voice: 'Rachel', stability: .5, setGenerating: value => { generating = value; }, setVoiceError: value => { if (value) errors++; }, onVoice: async () => null, onTakesChange: () => takesChanged++ });
  await voice();
  check('an interrupted voice request preserves takes and leaves no false error', () => { assert.equal(takesChanged, 0); assert.equal(errors, 0); assert.equal(generating, false); });
  h.cleanup(); pending.cleanup();
  console.log(`PASS: ${checks} live-gate checks. Health, passcode and provider calls are mocked.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
