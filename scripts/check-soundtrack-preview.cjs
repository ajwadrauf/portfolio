// Exercise the actual preview handlers with mocked media; no provider/network calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
let checks = 0;
const check = (condition, message) => { assert(condition, message); checks++; };
let slots = [], cursor = 0, effects = [];
const react = {
  useRef(value) { const i = cursor++; return slots[i] ??= { current: value }; },
  useState(value) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], next => { slots[i] = next; }]; },
  useEffect(fn, deps) { const i = cursor++; if (!slots[i] || deps.some((v,j) => v !== slots[i].deps[j])) { slots[i]?.cleanup?.(); effects.push(() => { slots[i] = { deps, cleanup: fn() }; }); } },
};
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ad/SoundtrackPreview.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports: mod.exports, require: n => n === 'react' ? react : n.endsWith('.css') ? { default: {} } : require(n) });
const walk = n => Array.isArray(n) ? n.flatMap(walk) : n && typeof n === 'object' ? [n, ...walk(n.props?.children)] : [];
const media = () => ({ paused: true, currentTime: 0, volume: 1, plays: 0, pauses: 0, play() { this.paused = false; this.plays++; return Promise.resolve(); }, pause() { this.paused = true; this.pauses++; } });
const a = media(), v = media();
let props = { soundtrackUrl: '/mix.wav', videoUrl: '/h3.mp4', originalAudioAvailable: true };
function render() { cursor = 0; const nodes = walk(mod.exports.SoundtrackPreview(props)); for (const n of nodes) { if (n.type === 'audio') n.props.ref.current = a; if (n.type === 'video') n.props.ref.current = v; } effects.splice(0).forEach(f => f()); return nodes; }
const find = (nodes, type, inputType) => nodes.find(n => n.type === type && (!inputType || n.props.type === inputType));
(async () => {
  let nodes = render();
  check(find(nodes, 'video').props.muted === true, 'Original audio defaults muted');
  check(find(nodes, 'input', 'range').props.disabled && v.volume === .5, 'Native volume defaults to 50% and stays disabled until selected');
  find(nodes, 'input', 'checkbox').props.onChange({ target: { checked: true } }); nodes = render();
  check(find(nodes, 'video').props.muted === false, 'Toggle enables the actual video audio');
  find(nodes, 'input', 'range').props.onChange({ target: { value: '.25' } }); nodes = render();
  check(v.volume === .25 && find(nodes, 'audio').props.src === '/mix.wav', 'Volume changes native video only; WAV source stays identical');
  a.currentTime = 3.125; a.paused = false; find(nodes, 'audio').props.onPlay();
  check(v.currentTime === 3.125 && v.plays === 1, 'Play starts picture at the exact soundtrack position');
  a.currentTime = 7; find(nodes, 'audio').props.onSeeked(); check(v.currentTime === 7, 'Seek follows soundtrack');
  v.currentTime = 5; find(nodes, 'audio').props.onTimeUpdate(); check(v.currentTime === 7, 'Drift is corrected');
  find(nodes, 'audio').props.onPause(); check(v.paused, 'Pause stops video');
  a.paused = false; find(nodes, 'audio').props.onPlaying(); find(nodes, 'audio').props.onWaiting(); check(v.paused, 'Soundtrack buffering pauses picture');
  find(nodes, 'audio').props.onPlaying(); check(!v.paused, 'Picture resumes after buffering');
  find(nodes, 'audio').props.onEnded(); check(v.paused, 'End stops picture');
  v.play = () => Promise.reject(new Error('Playback blocked')); a.paused = false;
  find(nodes, 'audio').props.onPlay(); await Promise.resolve(); nodes = render();
  check(a.paused && nodes.some(n => n.props?.role === 'alert'), 'Blocked video playback pauses soundtrack and reports a useful error');
  props = { ...props, originalAudioAvailable: false }; nodes = render();
  check(!find(nodes, 'input', 'checkbox') && find(nodes, 'video').props.muted, 'Motion guide never offers generated sound');
  props = { ...props, videoUrl: null }; nodes = render();
  check(!find(nodes, 'video') && !!find(nodes, 'audio'), 'Audio-only preview still works');
  check(slots.filter(s => s?.cleanup).length > 0, 'Media cleanup is registered');
  slots.forEach(s => s?.cleanup?.()); check(a.paused && v.paused, 'Unmount stops both media');
  console.log(`PASS: ${checks} soundtrack preview playback checks. No paid calls.`);
})().catch(e => { console.error(e); process.exit(1); });
