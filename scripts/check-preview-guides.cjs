// Real Three.js camera/geometry, with recorded 2D canvas and a fake WebGL surface.
// No browser, network, API key or paid generation is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const THREE = require('three');
const root = path.resolve(__dirname, '..');
let checks = 0;
const check = (name, fn) => { fn(); checks++; };
const near = (a, b, message = 'values agree') => assert(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`);

function loadModules(globals = {}, three = THREE) {
  const cache = {};
  function load(file) {
    let absolute = path.resolve(root, file);
    if (!fs.existsSync(absolute)) absolute += '.ts';
    if (cache[absolute]) return cache[absolute].exports;
    const mod = { exports: {} }; cache[absolute] = mod;
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, {
      module: mod, exports: mod.exports, Error, console,
      require(name) {
        if (name === 'three') return three;
        if (name.startsWith('@/')) return load('src/' + name.slice(2));
        if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name));
        throw new Error(`Unexpected test dependency: ${name}`);
      },
      ...globals,
    }, { filename: absolute });
    return mod.exports;
  }
  return load;
}

function mockRenderer() {
  const canvases = [], observers = [], renderers = [], info = [], errors = [];
  let decodedImages = 0;
  function canvas() {
    const calls = [], events = new Map();
    const element = {
      style: {}, width: 1, height: 1, hidden: false, removed: false, calls,
      setAttribute(name, value) { this[name] = value; },
      addEventListener(name, fn) { events.set(name, fn); },
      removeEventListener(name) { events.delete(name); },
      remove() { this.removed = true; },
      toDataURL(type) { this.encodes ??= []; this.encodes.push({ type, width: this.width, height: this.height }); if (this.failEncode) throw new Error('Simulated PNG encoding error'); return 'data:image/png;base64,ZXhwb3J0'; },
    };
    const context = new Proxy({ canvas: element, measureText: (text) => ({ width: String(text).length * 6.5 }) }, {
      get(target, key) { if (key in target) return target[key]; return (...args) => { calls.push({ op: String(key), args }); }; },
      set(target, key, value) { target[key] = value; return true; },
    });
    element.getContext = (type) => type === '2d' ? context : null;
    element.dispatch = (name, event) => events.get(name)?.(event);
    canvases.push(element); return element;
  }
  class WebGLRenderer {
    constructor() { this.domElement = canvas(); this.capabilities = { maxTextureSize: 8192, getMaxAnisotropy: () => 4 }; this.ratio = 1; this.frames = []; renderers.push(this); }
    setClearColor() {}
    setPixelRatio(value) { this.ratio = value; }
    getPixelRatio() { return this.ratio; }
    setSize(width, height) { this.width = width; this.height = height; this.domElement.width = width * this.ratio; this.domElement.height = height * this.ratio; }
    render(scene, camera) { scene.updateMatrixWorld(); camera.updateMatrixWorld(); this.scene = scene; this.camera = camera; this.frames.push({ position: camera.position.toArray(), up: camera.up.toArray(), width: this.width, height: this.height }); }
    getContext() { return { MAX_RENDERBUFFER_SIZE: 1, getParameter: () => 8192 }; }
    dispose() { this.disposed = true; }
    forceContextLoss() { this.lost = true; }
  }
  class ResizeObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(element) { this.element = element; }
    disconnect() { this.disconnected = true; }
  }
  class Image {
    naturalWidth = 400; naturalHeight = 600;
    set src(value) { this._src = value; if (value) { decodedImages++; queueMicrotask(() => this.onload?.()); } }
    get src() { return this._src; }
  }
  const children = [];
  const container = { clientWidth: 800, clientHeight: 560, style: {}, appendChild(element) { children.push(element); }, getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight, left: 0, top: 0 }; } };
  const load = loadModules({ window: { devicePixelRatio: 2 }, document: { createElement(tag) { assert.equal(tag, 'canvas'); return canvas(); } }, ResizeObserver, Image, queueMicrotask }, { ...THREE, WebGLRenderer });
  const renderer = load('src/components/packshots/box-renderer.ts').createBoxRenderer(container, (error) => errors.push(error), (value) => info.push(value));
  return { renderer, load, children, canvases, observers, renderers, info, errors, container, decodedImages: () => decodedImages };
}

function checkGuideMath() {
  const load = loadModules(), p = load('src/lib/packaging.ts'), g = load('src/lib/previewGuides.ts');
  const angles = ['front', 'back', 'left', 'right', 'top', 'bottom', 'hero34'];
  const dimensionsList = [{ width: 80, height: 120, depth: 45 }, { width: 10000, height: 10000, depth: 10000 }, { width: .01, height: .025, depth: .005 }, { width: 1, height: 10000, depth: 1 }, { width: 10000, height: 1, depth: 1 }];
  function inputFor(dimensions, angle, width, height, unit) {
    const half = p.boxFramingHalfExtent(dimensions), aspect = width / height;
    const camera = new THREE.OrthographicCamera(-half * Math.max(aspect, 1), half * Math.max(aspect, 1), half / Math.min(aspect, 1), -half / Math.min(aspect, 1), .01, 40);
    const pose = p.boxCameraPose(angle);
    camera.position.fromArray(pose.direction).normalize().multiplyScalar(8); camera.up.fromArray(pose.up); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    return { dimensions, unit, width, height, worldWidth: camera.right - camera.left, worldHeight: camera.top - camera.bottom, cameraDirection: camera.position.toArray(), project(tuple) { const point = new THREE.Vector3(...tuple).project(camera); return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }; } };
  }
  check('millimetres convert to inches once and retain small positive values', () => { assert.equal(g.formatGuideMeasurement(25.4, 'in'), '1 in'); assert.equal(g.formatGuideMeasurement(127, 'in'), '5 in'); assert.equal(g.formatGuideMeasurement(80, 'mm'), '80 mm'); assert.notEqual(g.formatGuideMeasurement(.001, 'in'), '0 in'); for (const invalid of [0, -1, NaN, Infinity]) assert.equal(g.formatGuideMeasurement(invalid, 'mm'), '—'); });
  for (const value of [1e-7, .02, .021, .5, 1, 1.1, 2, 2.01, 5, 9.9, 10, 101, 10000]) {
    check(`nice grid step brackets ${value} with the 1/2/5 series`, () => { const floor = g.niceGuideStep(value, 'floor'), ceil = g.niceGuideStep(value); assert(floor <= value * (1 + 1e-9)); assert(ceil >= value * (1 - 1e-9)); for (const step of [floor, ceil]) { const mantissa = step / (10 ** Math.floor(Math.log10(step))); assert([1, 2, 5, 10].some((n) => Math.abs(n - mantissa) < 1e-6)); } });
  }
  for (const invalid of [0, -1, Infinity, NaN]) check('invalid grid targets return no spacing', () => assert.equal(g.niceGuideStep(invalid), 0));
  const expectedAxes = { front: ['height', 'width'], back: ['height', 'width'], left: ['depth', 'height'], right: ['depth', 'height'], top: ['depth', 'width'], bottom: ['depth', 'width'], hero34: ['depth', 'height', 'width'] };
  for (const angle of angles) {
    const input = inputFor(dimensionsList[0], angle, 800, 560, 'mm');
    const plan = g.createPreviewGuidePlan(input);
    check(`${angle} labels only the measurable projected axes`, () => assert.deepEqual(Array.from(plan.dimensions, (d) => d.axis).sort(), expectedAxes[angle]));
  }
  for (const dimensions of dimensionsList) for (const [width, height] of [[800, 560], [390, 430], [120, 120]]) for (const angle of angles) for (const unit of ['mm', 'in']) {
    const input = inputFor(dimensions, angle, width, height, unit), plan = g.createPreviewGuidePlan(input);
    check('valid dimensions and camera produce a bounded physical grid', () => {
      assert(plan, `${JSON.stringify(dimensions)} ${angle} ${width}×${height} ${unit}`);
      assert(plan.grid.pixelsX >= 44 - 1e-6 && plan.grid.pixelsX <= 110 + 1e-6);
      near(plan.grid.pixelsX, plan.grid.pixelsY, 'grid cells stay square');
      const pixelsPerMm = (2 / Math.max(dimensions.width, dimensions.height, dimensions.depth)) * width / input.worldWidth;
      near(plan.grid.pixelsX, pixelsPerMm * plan.grid.millimetres, 'grid marks physical distance');
      near(plan.scale.pixels, pixelsPerMm * plan.scale.millimetres, 'scale bar marks physical distance');
      assert(plan.scale.pixels <= Math.min(96, width * .25) + 1e-6);
      assert(plan.scale.rect.x >= 0 && plan.scale.rect.x + plan.scale.rect.width <= width);
    });
    check('dimension leaders track projected geometry without overlapping labels', () => {
      const axes = new Set();
      for (const d of plan.dimensions) {
        assert(!axes.has(d.axis)); axes.add(d.axis);
        const rect = d.labelRect;
        assert(rect.x >= 7 && rect.y >= 7 && rect.x + rect.width <= width - 7 + 1e-6 && rect.y + rect.height <= height - 7 + 1e-6);
        assert(!g.guideRectsOverlap(rect, plan.scale.rect, 0));
        assert(d.labelAngle >= -Math.PI / 2 && d.labelAngle <= Math.PI / 2, 'letters remain upright');
        const axis = ['width', 'height', 'depth'].indexOf(d.axis), extent = [0, 0, 0]; extent[axis] = p.normalizedBoxDimensions(dimensions)[d.axis];
        const zero = input.project([0, 0, 0]), end = input.project(extent);
        near(Math.hypot(d.source[1].x - d.source[0].x, d.source[1].y - d.source[0].y), Math.hypot(end.x - zero.x, end.y - zero.y), 'leader measures the actual projected axis');
      }
      for (let i = 0; i < plan.dimensions.length; i++) for (let j = i + 1; j < plan.dimensions.length; j++) assert(!g.guideRectsOverlap(plan.dimensions[i].labelRect, plan.dimensions[j].labelRect, 0));
    });
  }
  const base = inputFor(dimensionsList[0], 'hero34', 800, 560, 'mm');
  for (const patch of [{ dimensions: { ...base.dimensions, width: 0 } }, { dimensions: { ...base.dimensions, height: Infinity } }, { dimensions: { ...base.dimensions, depth: 10001 } }, { width: 0 }, { height: 119 }, { worldWidth: NaN }, { cameraDirection: [0, NaN, 1] }, { bounds: { min: [0, 0, 0], max: [0, 0, 0] } }, { project: () => ({ x: NaN, y: 0 }) }]) check('invalid guide geometry is suppressed rather than mislabeled', () => assert.equal(g.createPreviewGuidePlan({ ...base, ...patch }), null));
  const bag = load('src/components/packshots/box-renderer.ts').createPackageGeometry(base.dimensions, 'pillow-bag');
  const bagPlan = g.createPreviewGuidePlan({ ...base, bounds: { min: bag.boundingBox.min.toArray(), max: bag.boundingBox.max.toArray() } });
  check('pillow bag guides use external W/H/D bounds, not shrunken seam dimensions', () => { assert.deepEqual(Array.from(bagPlan.dimensions, (d) => d.label).sort(), ['D 45 mm', 'H 120 mm', 'W 80 mm']); const normalized = p.normalizedBoxDimensions(base.dimensions); near(bag.boundingBox.max.x - bag.boundingBox.min.x, normalized.width); near(bag.boundingBox.max.y - bag.boundingBox.min.y, normalized.height); near(bag.boundingBox.max.z - bag.boundingBox.min.z, normalized.depth); });
  bag.dispose();
}

async function checkRenderer() {
  const m = mockRenderer();
  const settings = { dimensions: { width: 80, height: 120, depth: 45 }, panels: { front: { dataUrl: 'data:image/png;base64,dGVzdA==', name: 'label.png', rotation: 0, fit: 'contain', background: '#ffffff' } }, finish: 'matte', baseColor: '#ffffff', shape: 'carton' };
  await m.renderer.update(settings);
  const webgl = m.renderers[0], mainCanvas = webgl.domElement;
  const mesh = webgl.scene.children.find((child) => child.isMesh);
  const geometry = mesh.geometry, material = mesh.material, texture = material.find((item) => item.map).map;
  const sceneChildren = [...webgl.scene.children];
  const decoded = m.decodedImages();
  m.renderer.setGuides({ measurements: true, grid: true, unit: 'mm' });
  check('guide canvas is separate from exported WebGL surface', () => { assert(m.children.length >= 2); assert(m.children.some((child) => child !== mainCanvas && child.calls)); });
  const overlay = m.children.find((child) => child !== mainCanvas);
  check('guide layer does not capture pointer interaction', () => assert.equal(overlay.style.pointerEvents, 'none'));
  check('guides produce a measurement readout and labels', () => { assert(m.info.length > 0); assert(overlay.calls.some((call) => call.op === 'fillText')); });
  for (const guides of [{ measurements: false, grid: true, unit: 'in' }, { measurements: true, grid: false, unit: 'mm' }, { measurements: true, grid: true, unit: 'in' }]) m.renderer.setGuides(guides);
  check('guide toggles and unit switches preserve geometry, textures and decode count', () => { const current = webgl.scene.children.find((child) => child.isMesh); assert.equal(current.geometry, geometry); assert.equal(current.material, material); assert.equal(current.material.find((item) => item.map).map, texture); assert.equal(m.decodedImages(), decoded); });
  const beforeOrbit = overlay.calls.length;
  m.renderer.orbit(0.5, 0.2);
  check('orbit redraws projected guides', () => assert(overlay.calls.length > beforeOrbit));
  for (const angle of ['front', 'back', 'left', 'right', 'top', 'bottom', 'hero34']) {
    m.renderer.setAngle(angle);
    check(`${angle} leaves every canvas coordinate finite`, () => { for (const call of overlay.calls) for (const arg of call.args) if (typeof arg === 'number') assert(Number.isFinite(arg)); });
    overlay.calls.length = 0;
  }
  m.container.clientWidth = 390; m.container.clientHeight = 430; m.observers[0].callback();
  check('resize updates both preview surfaces at device pixel ratio', () => { assert.equal(mainCanvas.width, 780); assert.equal(mainCanvas.height, 860); assert.equal(overlay.width, 780); assert.equal(overlay.height, 860); });
  m.renderer.orbit(-0.3, 0.1);
  const position = webgl.camera.position.clone(), up = webgl.camera.up.clone(), ratio = webgl.getPixelRatio();
  const visible = { display: overlay.style.display, visibility: overlay.style.visibility, hidden: overlay.hidden };
  const png = await m.renderer.renderAngle('front', 1024);
  check('PNG encoding uses the clean WebGL canvas only', () => { assert(png.startsWith('data:image/png;base64,')); assert.equal(mainCanvas.encodes.length, 1); assert.equal(mainCanvas.encodes[0].width, 1024); assert(!overlay.encodes); assert.equal(mainCanvas.calls.length, 0); assert.equal(webgl.scene.children.length, sceneChildren.length); webgl.scene.children.forEach((child, index) => assert.equal(child, sceneChildren[index])); });
  check('export restores the orbit camera, DPR and preview size', () => { near(webgl.camera.position.distanceTo(position), 0); near(webgl.camera.up.distanceTo(up), 0); assert.equal(webgl.getPixelRatio(), ratio); assert.equal(mainCanvas.width, 780); assert.equal(mainCanvas.height, 860); });
  check('guide visibility is restored after export', () => assert.deepEqual({ display: overlay.style.display, visibility: overlay.style.visibility, hidden: overlay.hidden }, visible));
  mainCanvas.failEncode = true;
  await assert.rejects(m.renderer.renderAngle('right', 1024), /Simulated PNG encoding error/);
  check('failed PNG encoding still restores camera and preview surfaces', () => { near(webgl.camera.position.distanceTo(position), 0); assert.equal(webgl.getPixelRatio(), ratio); assert.equal(mainCanvas.width, 780); assert.deepEqual({ display: overlay.style.display, visibility: overlay.style.visibility, hidden: overlay.hidden }, visible); });
  m.renderer.dispose();
  check('dispose removes both canvases and disconnects observation', () => { assert(m.children.every((child) => child.removed)); assert(m.observers[0].disconnected); assert(webgl.disposed); assert(webgl.lost); });
  m.renderer.dispose();
  await assert.rejects(m.renderer.renderAngle('front', 1024), /closed/);
  check('disposed renderer cannot export', () => assert.equal(m.errors.length, 0));
}

async function checkPreviewLifecycle() {
  const slots = [], effects = [], operations = [];
  let cursor = 0, dirty = true, tree;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    forwardRef: (fn) => fn,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], (next) => { const value = typeof next === 'function' ? next(slots[i]) : next; if (!Object.is(value, slots[i])) { slots[i] = value; dirty = true; } }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(fn, deps) { const i = cursor++; if (!effects[i] || !same(effects[i].deps, deps)) effects[i] = { deps, fn, pending: true, cleanup: effects[i]?.cleanup }; },
    useImperativeHandle(ref, create) { ref.current = create(); },
  };
  const engine = { update(settings) { operations.push({ method: 'update', settings }); return Promise.resolve(); }, setGuides(options) { operations.push({ method: 'setGuides', options: { ...options } }); }, dispose() { operations.push({ method: 'dispose' }); }, orbit() { operations.push({ method: 'orbit' }); }, setAngle(angle) { operations.push({ method: 'setAngle', angle }); }, renderAngle: async () => 'data:image/png;base64,clean' };
  const load = loadModules();
  const mod = { exports: {} }, file = path.join(root, 'src/components/packshots/BoxPreview.tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, {
    module: mod, exports: mod.exports, Error,
    require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === './box-renderer') return { createBoxRenderer: () => engine };
      if (name.endsWith('.css')) return {};
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      throw new Error(`Unexpected preview dependency: ${name}`);
    },
  }, { filename: file });
  const ref = {}, container = {};
  let props = { dimensions: { width: 80, height: 120, depth: 45 }, panels: {}, finish: 'matte', baseColor: '#ffffff', shape: 'carton', displayUnit: 'mm' };
  const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : node && typeof node === 'object' ? [node, ...walk(node.props?.children)] : [];
  const textOf = (node) => Array.isArray(node) ? node.map(textOf).join(' ') : node && typeof node === 'object' ? textOf(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
  function render() {
    for (let iterations = 0; dirty; iterations++) {
      assert(iterations < 20); dirty = false; cursor = 0; tree = mod.exports.BoxPreview(props, ref);
      for (const node of walk(tree)) if (node.props?.ref && node.props.role === 'group') node.props.ref.current = container;
      for (const effect of effects) if (effect?.pending) { effect.cleanup?.(); effect.pending = false; effect.cleanup = effect.fn(); }
    }
  }
  async function settle() { for (let i = 0; i < 5; i++) { await new Promise(setImmediate); render(); } }
  const button = (name) => walk(tree).find((node) => node.type === 'button' && textOf(node).trim() === name);
  render(); ref.current.selectView('back'); render(); await settle();
  check('preview boots with both guides on before its first artwork update', () => { assert.equal(operations[0].method, 'setGuides'); assert.equal(operations[0].options.measurements, true); assert.equal(operations[0].options.grid, true); assert.equal(operations[2].method, 'update'); assert.equal(operations.filter((op) => op.method === 'update').length, 1); assert.equal(button('Measurements').props.disabled, false); assert.equal(button('Measurements').props['aria-pressed'], true); assert.equal(button('Grid').props['aria-pressed'], true); });
  check('face selection before renderer startup is applied when ready', () => { assert.equal(operations[1].angle, 'back'); assert.equal(button('Back').props['aria-pressed'], true); });
  for (const face of ['front', 'back', 'left', 'right', 'top', 'bottom']) {
    ref.current.selectView(face); render();
    check(`${face} artwork selection changes camera and angle indicator`, () => { assert.equal(operations.at(-1).angle, face); assert.equal(button(face[0].toUpperCase() + face.slice(1)).props['aria-pressed'], true); });
  }
  button('←').props.onClick(); render();
  check('free rotation remains available after a face selection', () => { assert.equal(operations.at(-1).method, 'orbit'); assert.equal(button('Bottom').props['aria-pressed'], false); });
  ref.current.selectView('bottom'); render();
  check('reselecting the same artwork face restores its angle after orbiting', () => { assert.equal(operations.at(-1).angle, 'bottom'); assert.equal(button('Bottom').props['aria-pressed'], true); });
  const updatesBefore = operations.filter((op) => op.method === 'update').length;
  button('Measurements').props.onClick(); render(); button('Grid').props.onClick(); render();
  check('default guides can still be switched off', () => { assert.equal(operations.at(-1).options.measurements, false); assert.equal(operations.at(-1).options.grid, false); });
  button('Measurements').props.onClick(); render(); button('Grid').props.onClick(); render();
  props = { ...props, displayUnit: 'in' }; dirty = true; render(); await settle();
  check('measurement/grid/unit changes never re-run artwork update', () => { assert.equal(operations.filter((op) => op.method === 'update').length, updatesBefore); const options = operations.at(-1).options; assert.equal(options.measurements, true); assert.equal(options.grid, true); assert.equal(options.unit, 'in'); });
  check('inch readout uses canonical millimetres once', () => assert.match(textOf(tree), /3\.1496 in/));
  props = { ...props, dimensions: { width: 0, height: 120, depth: 45 } }; dirty = true; render(); await settle();
  check('invalid dimensions force both renderer aids off and disable their controls', () => { const call = operations.filter((op) => op.method === 'setGuides').at(-1); assert.equal(call.options.measurements, false); assert.equal(call.options.grid, false); assert(button('Measurements').props.disabled); assert(button('Grid').props.disabled); });
  for (const effect of effects) effect?.cleanup?.();
  check('preview effect cleanup disposes its engine once', () => assert.equal(operations.filter((op) => op.method === 'dispose').length, 1));
}

(async () => {
  checkGuideMath();
  await checkRenderer();
  await checkPreviewLifecycle();
  console.log(`PASS: ${checks} preview guide checks; real Three.js camera math, mocked browser canvases, no network or AI calls.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
