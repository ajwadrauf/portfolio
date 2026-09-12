// Offline storage, portability, review and decision tests. No provider calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { indexedDB } = require('fake-indexeddb');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  let full = path.resolve(root, file);
  if (!fs.existsSync(full)) full += '.ts';
  if (cache.has(full)) return cache.get(full).exports;
  const mod = { exports: {} }; cache.set(full, mod);
  const output = ts.transpileModule(fs.readFileSync(full,'utf8'), { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true } }).outputText;
  vm.runInNewContext(output, { module:mod, exports:mod.exports, process:{env:{}}, Blob, URL, crypto:webcrypto, indexedDB, setTimeout, clearTimeout, Error, Date, console, TextEncoder,
    require(id) { if (id.startsWith('@/')) return load('src/'+id.slice(2)); if (id.startsWith('.')) return load(path.resolve(path.dirname(full),id)); return require(id); }
  }, {filename:full}); return mod.exports;
}
let checks=0;
async function check(name, fn) { await fn(); checks++; }
(async()=>{
  const s=load('src/lib/studioProjects.ts'), d=load('src/lib/studioDecisions.ts'), r=load('src/lib/manualReview.ts'), m=load('src/lib/models.ts');
  await check('new example includes supplied H3 film and separate voiceover',()=>{ const p=s.newStudioProject('VELUNE','velune'); assert.equal(p.assets.find(a=>a.id==='velune-final').status,'ready'); assert(p.assets.find(a=>a.id==='velune-final').url.endsWith('/velune-h3.mp4')); assert(p.assets.find(a=>a.id==='velune-voiceover').url.endsWith('.wav')); assert.equal(p.assets.find(a=>a.id==='velune-motion').source,'blender'); });
  await check('nine supplied visual references coexist with the original planning artwork',()=>{const refs=s.veluneVisualAssets(),p=s.newStudioProject('VELUNE','velune');assert.equal(refs.length,9);assert.equal(new Set(refs.map(r=>r.id)).size,9);for(const asset of refs){assert(p.assets.some(a=>a.id===asset.id));assert(fs.existsSync(path.join(root,'public',asset.url)));assert.equal(asset.metadata.provenance,'AI-generated reference supplied by Ajwad');}assert(p.assets.some(a=>a.id==='velune-packaging'));assert(p.assets.some(a=>a.id==='velune-report'));});
  await check('Ad example binds all references in declared order and flags older project omissions',()=>{const ad=load('src/lib/veluneAdExample.ts'),draft=ad.veluneAdExample(s.newStudioProject('VELUNE','velune').assets),helpers=load('src/lib/adDraft.ts');assert(helpers.parseAdDraft(draft));assert.equal(draft.references.length,10);assert.equal(draft.references.filter(r=>r.kind==='image').length,9);assert.equal(helpers.referenceBindingProblems(draft.references,draft.referenceManifest).length,0);assert(!draft.references.some(r=>r.role==='character'));assert(!draft.references.some(r=>r.id==='velune-report-v2'));const old=ad.veluneAdExample(s.veluneAssets().filter(a=>!a.id.startsWith('velune-ref-')));assert.equal(old.unattachedSlots.length,9);assert.equal(helpers.referenceBindingProblems(old.references,old.referenceManifest).length,9);assert(draft.sceneCards.find(s=>s.id==='S07').referenceIds[1]==='velune-ref-v2-studio');});
  await check('ready without media rejected',()=>assert.throws(()=>s.validateStudioAsset({id:'x',name:'x',kind:'video',source:'generated',status:'ready'}),/file/));
  await check('unsafe media rejected',()=>{ for(const url of ['javascript:alert(1)','//evil.com/x','https://fal.media.evil.com/x','https://name:pass@fal.media/x']) assert(!s.safeStudioMediaUrl(url),url); assert(s.safeStudioMediaUrl('/studio/velune/animatic.mp4')); });
  await check('duplicate assets rejected',()=>{ const p=s.newStudioProject('x','velune');p.assets.push(p.assets[0]); assert.throws(()=>s.validateStudioProject(p),/unique/); });
  const a=await s.createStudioProject(s.newStudioProject('A')), b=await s.createStudioProject(s.newStudioProject('B'));
  await check('simultaneous tools preserve both drafts',async()=>{ await Promise.all([s.patchStudioProject(a.id,{tool:'ad',draft:{prompt:'A'}}),s.patchStudioProject(a.id,{tool:'blender',draft:{duration:15}})]);const p=await s.loadStudioProject(a.id);assert.equal(p.drafts.ad.prompt,'A');assert.equal(p.drafts.blender.duration,15); });
  await check('parallel project saves remain isolated',async()=>{await Promise.all([s.patchStudioProject(a.id,{tool:'late',draft:'original'}),s.patchStudioProject(b.id,{tool:'late',draft:'other'})]);assert.equal((await s.loadStudioProject(a.id)).drafts.late,'original');assert.equal((await s.loadStudioProject(b.id)).drafts.late,'other');});
  await check('asset replacement does not duplicate',async()=>{ const asset={id:'out',name:'Ready',kind:'image',source:'generated',status:'ready',url:'https://fal.media/x.png'}; await s.patchStudioProject(a.id,{asset});await s.patchStudioProject(a.id,{asset:{...asset,name:'Renamed'}});assert.equal((await s.loadStudioProject(a.id)).assets.length,1);});
  await check('invalid write leaves previous state intact',async()=>{await assert.rejects(()=>s.patchStudioProject(a.id,{asset:{id:'bad',name:'x',kind:'video',source:'generated',status:'ready'}}));assert.equal((await s.loadStudioProject(a.id)).assets.length,1);});
  await check('summaries contain no heavy media or drafts',async()=>{ const all=await s.listStudioProjects();assert.equal(all.length,2);assert(all.every(p=>!('assets'in p)&&!('drafts'in p))); });
  await check('portable copies strip handles and interrupted jobs',()=>{const p=s.portableProject({...a,drafts:{campaign:{jobs:[{requestId:'paid',status:'polling',apiKey:'secret'}]},ad:{falRequestId:'x',operationName:'y'}}}); assert.equal(p.drafts.campaign.jobs[0].status,'interrupted');assert(!JSON.stringify(p).includes('secret'));assert(!JSON.stringify(p).includes('paid'));assert(!('falRequestId'in p.drafts.ad));});
  await check('deleted project rejects late write',async()=>{ await s.deleteStudioProject(b.id);await assert.rejects(()=>s.patchStudioProject(b.id,{tool:'ad',draft:'late'}),/no longer exists/);assert.equal(await s.loadStudioProject(b.id),null); });
  await check('24-project bound aborts safely',async()=>{for(let i=0;i<23;i++)await s.createStudioProject(s.newStudioProject('p'+i));await assert.rejects(()=>s.createStudioProject(s.newStudioProject('overflow')),/24 projects/);assert.equal((await s.listStudioProjects()).length,24);});
  await check('cost includes repeats and labour',()=>{ const x=d.productionComparison(d.DEFAULT_PRODUCTION_SCENARIO);assert.equal(x.renders,200);assert.equal(x.review,800);assert.equal(x.suite,1090);assert.equal(x.api,1400);assert.equal(x.apiPerAsset,14); });
  await check('incomplete imported assumptions rejected',()=>assert.throws(()=>d.productionComparison({accepted:5}),/positive/));
  await check('zero denominator rejected',()=>assert.throws(()=>d.productionComparison({...d.DEFAULT_PRODUCTION_SCENARIO,amortizationMonths:0})));
  await check('more input video increases same-route estimated cost',()=>{ const model=m.MODELS['seedance-2.5-ref']; if(!model)throw new Error('expected configured route');const a=d.scenarioForModel(model,{...d.DEFAULT_MODEL_SCENARIO,inputVideoSeconds:0}),b=d.scenarioForModel(model,{...d.DEFAULT_MODEL_SCENARIO,inputVideoSeconds:15}); assert(b.cost>a.cost); });
  await check('invalid input length and fractional ref count blocked',()=>{const model=m.MODELS['seedance-2.5-ref'];assert(!d.scenarioForModel(model,{...d.DEFAULT_MODEL_SCENARIO,inputVideoSeconds:31}).compatible);assert(!d.scenarioForModel(model,{...d.DEFAULT_MODEL_SCENARIO,referenceImages:1.2}).compatible);});
  await check('registry-only model cannot route to an unsupported tool',()=>{assert(!d.scenarioForModel(m.MODELS['flux-kontext'],d.DEFAULT_MODEL_SCENARIO).compatible);assert(d.scenarioForModel(m.MODELS['seedream-4'],d.DEFAULT_MODEL_SCENARIO).compatible);assert(d.scenarioForModel(m.MODELS['flux-2-pro'],d.DEFAULT_MODEL_SCENARIO).compatible);});
  await check('voice comparison respects actual request length',()=>{const voice=Object.values(m.MODELS).find(x=>x.kind==='voice');for(const characters of [0,1201])assert(!d.scenarioForModel(voice,{...d.DEFAULT_MODEL_SCENARIO,characters}).compatible);assert(d.scenarioForModel(voice,{...d.DEFAULT_MODEL_SCENARIO,characters:1200}).compatible);});
  const review={assetId:'out',assetName:'Output',assetVersion:'v1',sourceIdentity:'test',reviewer:'Reviewer',decision:'approved',checks:{a:{status:'pass',evidence:'Evidence'},b:{status:'not_applicable',evidence:'No dialogue'}},notes:'',checklistVersion:'v1'};
  await check('approval requires all evidence including NA',()=>{assert.equal(r.manualReviewProblems(review,['a','b']).length,0);assert(r.manualReviewProblems({...review,checks:{...review.checks,b:{status:'not_applicable',evidence:''}}},['a','b']).length>0);});
  await check('flags cannot approve',()=>assert(r.manualReviewProblems({...review,checks:{a:{status:'flag',evidence:'Blur'}}},['a']).length>0));
  await check('human required',()=>assert(r.manualReviewProblems({...review,reviewer:''},['a']).length>0));
  await check('malformed imports cannot hydrate as review',()=>{assert.equal(r.readManualReview({...review,checks:null}),null);assert.equal(r.readManualReview({...review,checks:{a:{status:'invented'}}}),null);assert(r.readManualReview(review));});
  const { harness, textOf, deferred } = require('./check-campaign-handoff.cjs');
  await check('completed packshot save keeps original project and one copy per click', async()=>{
    const pending=deferred(), calls=[], one={project:{id:'one',name:'One'}, saveAsset:async(asset)=>calls.push({project:'one',asset})}; let active=one; let reads=0;
    const screen=harness('src/components/packshots/PackshotActions.tsx','PackshotActions',{source:'real.png',meta:{name:'Front',angle:'front',source:'artwork',variant:'Local',review:'needs-review'}},{overrides:{'@/components/studio/StudioProjectProvider':{useStudioProject:()=>active},'@/lib/campaignHandoff':{sourceImage:async()=>{reads++;return pending.promise;},blobToCampaignDataUrl:async()=> 'data:image/png;base64,aW1hZ2U='}}});
    const button=screen.nodes().find(n=>n.type==='button'&&textOf(n).includes('Keep in project assets'));button.props.onClick();button.props.onClick();active={project:{id:'two',name:'Two'},saveAsset:async()=>{throw new Error('wrong project')}};screen.render({source:'other.png',meta:{name:'Other',angle:'front',source:'artwork',variant:'Local',review:'needs-review'}});pending.resolve(new Blob(['image']));await screen.settle();assert.equal(reads,1);assert.equal(calls.length,1);assert.equal(calls[0].project,'one');assert.equal(calls[0].asset.name,'Front');
  });
  console.log(`${checks} connected-studio checks passed. No paid requests.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
