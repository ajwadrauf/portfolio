// Real intake, immutable snapshots and API routes. Providers and storage are mocked.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { harness, deferred } = require('./check-campaign-handoff.cjs');
const root = path.resolve(__dirname, '..');
const plain = value => JSON.parse(JSON.stringify(value));
let count = 0;
function check(label, fn) { fn(); count++; }
function load(file, overrides = {}) {
  const cache = {};
  function read(filename) {
    filename = path.resolve(root, filename); if (!path.extname(filename)) filename += '.ts';
    if (cache[filename]) return cache[filename].exports;
    const module = { exports: {} }; cache[filename] = module;
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, process: { env: {} }, console, URL, Blob, Request, Response, Buffer,
      fetch() { throw new Error('Unmocked network forbidden'); }, require(name) {
        if (name in overrides) return overrides[name];
        if (name === 'server-only') return {};
        if (name === 'next/server') return { NextResponse: { json: (data, init) => Response.json(data, init) } };
        return name.startsWith('.') ? read(path.resolve(path.dirname(filename), name)) : name.startsWith('@/') ? read('src/' + name.slice(2)) : require(name);
      } }, { filename });
    return module.exports;
  }
  return read(file);
}
const helpers = load('src/lib/campaignWorkspace.ts');
const referenceHelpers = load('src/lib/campaignReferences.ts');
const models = load('src/lib/models.ts');
const angles = ['front', 'back', 'left', 'right', 'top', 'bottom', 'hero34'];
const images = angles.map((angle, index) => ({name: `Carton · ${angle}`, dataUrl: `data:image/png;base64,${Buffer.from(`image-${index}`).toString('base64')}`}));
const brief = helpers.veluneCampaignDraft().brief;
const id = '05bdfe1e-5276-4d67-9a13-8eb67b9f2ee9';
const views = angles.map((angle, index) => ({blob: new Blob([String(index)], {type:'image/png'}), meta:{name:images[index].name,angle,source:'artwork',variant:'Local artwork render',review:'needs-review'}}));
const record = {version:1,id,createdAt:Date.now(),expiresAt:Date.now()+86400000,...views[0],additionalViews:views.slice(1)};
const analysis = {productContext:{name:'Carton',category:'food',colors:['green'],texture:'matte',packagingType:'box'},questions:[{id:'mood',question:'Mood?',options:['Warm'],defaultAnswer:'Warm'}]};
function mount(draft = helpers.emptyCampaignDraft(), options = {}) {
  const calls=[], writes=[], prepared=[];
  const workspace = {ready:true,project:{id:'project-one',drafts:{campaign:draft},assets:[]},saveDraft:async (tool,data)=>writes.push(structuredClone(data)),saveAsset:async()=>{}};
  const screen = harness('src/app/ai-studio/studio/StudioWizard.tsx','StudioWizard',{}, {
    href:options.intake ? `https://example.test/ai-studio/studio?packshot=${id}` : undefined,
    overrides:{
      '@/components/studio/StudioProjectProvider':{useStudioProject:()=>workspace},
      '@/lib/campaignHandoff':{validCampaignHandoffId:value=>value===id,loadCampaignHandoff:async()=>record},
      '@/lib/campaignReferenceImage':{prepareCampaignReference:async (source,budget)=>{prepared.push({source,budget});return images[Number(await source.text())].dataUrl;}},
    },
    fetch: async (url,init)=>{
      const body=JSON.parse(init.body); calls.push({url,body});
      if (url==='/api/analyze') return Response.json(analysis);
      if (url==='/api/brief') return Response.json({brief});
      return options.response ? options.response(url,body) : Response.json({imageDataUrl:'data:image/png;base64,aGVybw==',cost:.134});
    },
  });
  return {screen,calls,writes,prepared};
}
function generationDraft() {
  const draft=helpers.veluneCampaignDraft(); draft.workflow='batch';draft.step='deliverables';draft.exactText=false;
  draft.imageDataUrl=images[0].dataUrl;draft.referenceImages=images;
  draft.selected=Object.fromEntries(Object.keys(draft.selected).map(id=>[id,id==='hero_still']));
  return draft;
}
(async()=>{
  const existing=helpers.veluneCampaignDraft(); existing.step='brief';
  const intake=mount(existing,{intake:true});await intake.screen.settle();
  check('new seven-view handoff is visible above an existing saved brief without a paid request',()=>{assert(intake.screen.named('ImportedPackshotCard'));assert.equal(intake.calls.length,0);assert.equal(intake.screen.objectUrls.length,7);});
  intake.screen.named('ImportedPackshotCard').props.onLeadView(6); intake.screen.render();
  intake.screen.named('ImportedPackshotCard').props.onAnalyze(); await intake.screen.settle();
  check('chosen hero view leads analysis, with all seven references and bounded preparation',()=>{assert.equal(intake.calls[0].body.imageDataUrl,images[6].dataUrl);assert.equal(intake.calls[0].body.referenceImages.length,7);assert.equal(intake.prepared.length,7);assert(intake.prepared.every(item=>item.budget<380000));});
  intake.screen.named('ClarifyStep').props.onSubmit();await intake.screen.settle();
  check('brief receives every reference as well as the selected lead',()=>{assert.equal(intake.calls[1].url,'/api/brief');assert.equal(intake.calls[1].body.referenceImages.length,7);assert.equal(intake.calls[1].body.referenceImages[0].name,images[6].name);});
  intake.screen.named('BriefStep').props.onNext();intake.screen.render();
  check('incompatible defaults switch to models that can accept the entire set',()=>{const props=intake.screen.named('DeliverablesStep').props;for(const key of ['hero_still','adapt_story','adapt_banner','seasonal_variant'])assert.equal(props.modelChoice[key],'nano-banana-pro');assert.equal(props.referenceCount,7);});
  intake.screen.unmount();await new Promise(setImmediate);
  check('all reference metadata and images persist and every preview URL is released',()=>{assert.equal(intake.writes.at(-1).referenceImages.length,7);assert.equal(intake.screen.revoked.length,7);});
  const restored=helpers.readCampaignDraft(intake.writes.at(-1));
  check('reload retains the chosen lead and all seven images',()=>{assert.equal(restored.imageDataUrl,images[6].dataUrl);assert.equal(restored.referenceImages.length,7);});
  const noLoss=mount(generationDraft());await noLoss.screen.settle();noLoss.screen.named('DeliverablesStep').props.onGenerate();await noLoss.screen.settle();
  check('still submission includes all seven product views',()=>assert.deepEqual(plain(noLoss.calls[0].body.referenceImages),images));
  const saved=noLoss.writes.at(-1);const snapshot=saved.snapshots[saved.jobs[0].snapshotId];
  check('durable generation snapshot includes the whole set',()=>assert.deepEqual(plain(snapshot.referenceImages),images));noLoss.screen.unmount();
  const retryDraft=structuredClone(saved);retryDraft.jobs[0].status='failed';retryDraft.referenceImages=images.slice(0,2);
  const retry=mount(retryDraft);await retry.screen.settle();const results=retry.screen.named('CampaignResults').props;results.onRetry(results.jobs[0]);await retry.screen.settle();
  check('retry uses all seven original snapshot views even if current references changed',()=>assert.equal(retry.calls[0].body.referenceImages.length,7));retry.screen.unmount();
  const incompatible=generationDraft();incompatible.selected.hero_still=false;incompatible.selected.adapt_story=true;incompatible.modelChoice.adapt_story='nano-banana-flash';
  const blocked=mount(incompatible);await blocked.screen.settle();blocked.screen.named('DeliverablesStep').props.onGenerate();await blocked.screen.settle();
  check('unsupported model is blocked before any generation or job intent',()=>{assert.equal(blocked.calls.length,0);assert.match(blocked.screen.text(),/cannot use all 7/);assert(!blocked.writes.some(d=>d.jobs.length));});blocked.screen.unmount();
  const adapted=generationDraft();adapted.workflow='hero';adapted.approvedHeroId='approved';adapted.selected.hero_still=false;adapted.selected.adapt_story=true;adapted.modelChoice.adapt_story='nano-banana-pro';
  adapted.snapshots.original={id:'original',brief,imageDataUrl:images[0].dataUrl,referenceImages:images,exactText:false};adapted.jobs=[{id:'approved',deliverableId:'hero_still',modelId:'nano-banana-pro',snapshotId:'original',status:'done',imageDataUrl:'data:image/png;base64,aGVybw==',cost:.134}];
  const hero=mount(adapted);await hero.screen.settle();hero.screen.named('DeliverablesStep').props.onGenerate();await hero.screen.settle();
  check('approved hero is accompanied by all seven original views for adaptations',()=>{const body=hero.calls[0].body;assert(body.approvedHero);assert.equal(referenceHelpers.campaignImageInputs(body.imageDataUrl,body.referenceImages).length,8);});hero.screen.unmount();
  const videoDraft=generationDraft();videoDraft.selected.hero_still=false;videoDraft.selected.hero_video=true;
  const video=mount(videoDraft,{response:()=>Response.json({mock:true,posterDataUrl:images[0].dataUrl})});await video.screen.settle();video.screen.named('DeliverablesStep').props.onGenerate();await video.screen.settle();
  check('video request explicitly uses its lead frame while the saved set remains intact',()=>{assert.equal(video.calls[0].url,'/api/generate/video');assert.equal(video.calls[0].body.imageDataUrl,images[0].dataUrl);assert.equal(video.calls[0].body.referenceImages,undefined);assert.equal(video.writes.at(-1).referenceImages.length,7);});video.screen.unmount();
  check('invalid saved reference set is rejected rather than partially restored',()=>{assert.equal(helpers.readCampaignDraft({...generationDraft(),referenceImages:[...images,{name:'extra',dataUrl:images[0].dataUrl}]}),null);});
  let spends=0;const providerCalls=[];
  const overrides={
    '@/lib/auth':{unlocked:()=>true,consume:()=>{spends++;return {ok:true};},liveJson:(_spend,data)=>Response.json(data)},
    '@/lib/models':{...models,hasGeminiKey:()=>true,hasFalKey:()=>true,isDryRun:()=>false},
    '@/lib/gemini':{dataUrlToInline:dataUrl=>({mimeType:'image/png',data:dataUrl.split(',')[1]}),generateImage:async input=>{providerCalls.push(input);return {dataUrl:images[0].dataUrl};},reasonJson:async input=>{providerCalls.push(input);return analysis;}},
    '@/lib/fal':{falGenerateImage:async()=>{throw new Error('Unsupported provider must not be called');}},
  };
  const route=load('src/app/api/generate/image/route.ts',overrides);
  const request=(body)=>new Request('https://example.test/api/generate/image',{method:'POST',body:JSON.stringify(body)});
  const body={deliverableId:'hero_still',modelId:'nano-banana-pro',brief,imageDataUrl:images[6].dataUrl,referenceImages:images};
  const ok=await route.POST(request(body));
  check('real image route forwards all seven images to Gemini, lead first, with named reference instructions',()=>{assert.equal(ok.status,200);assert.equal(spends,1);assert.equal(providerCalls[0].referenceImages.length,7);assert.equal(providerCalls[0].referenceImages[0].data,images[6].dataUrl.split(',')[1]);assert.match(providerCalls[0].prompt,/ONE product/);assert.match(providerCalls[0].prompt,/Carton · back/);});
  const tooMany=await route.POST(request({...body,deliverableId:'adapt_story',modelId:'nano-banana-flash'}));
  check('server independently blocks incompatible models before billing',()=>{assert.equal(tooMany.status,400);assert.equal(spends,1);assert.equal(providerCalls.length,1);});
  const invalid=await route.POST(request({...body,referenceImages:[{name:'invalid',dataUrl:'https://example.test/image.png'}]}));
  check('server rejects invalid reference payloads before billing',()=>{assert.equal(invalid.status,400);assert.equal(spends,1);});
  const large='data:image/png;base64,'+'A'.repeat(600000);
  const oversized=await route.POST(request({...body,imageDataUrl:large,referenceImages:images.map(item=>({...item,dataUrl:large}))}));
  check('server rejects oversized image sets before billing',()=>{assert.equal(oversized.status,400);assert.equal(spends,1);});
  for(const name of ['analyze','brief']){
    const api=load(`src/app/api/${name}/route.ts`,overrides);await api.POST(request({...body,productContext:analysis.productContext,answers:[]}));
    check(`${name} sends all seven actual images to the reasoning provider`,()=>assert.equal(providerCalls.at(-1).images.length,7));
  }
  const pending=deferred(),sent=[];
  const button=harness('src/components/packshots/CampaignHandoffButton.tsx','CampaignHandoffButton',{sources:views.map((view,index)=>({source:images[index].dataUrl,meta:view.meta})),label:'Take 7 views'}, {overrides:{'@/lib/campaignHandoff':{saveCampaignHandoffSet:(sources,settings)=>{sent.push({sources,settings});return pending.promise;}}}});
  button.nodes().find(n=>n.type==='button').props.onClick();button.nodes().find(n=>n.type==='button').props.onClick();
  check('set CTA uses one atomic transfer for seven views despite double click',()=>{assert.equal(sent.length,1);assert.equal(sent[0].sources.length,7);});
  pending.resolve({id});await button.settle();
  check('blocked popup leaves a working link for the whole set',()=>assert.match(button.nodes().find(n=>n.type==='a').props.href,/packshot=/));button.unmount();
  console.log(`PASS: ${count} campaign reference-set checks. No live providers or credentials used.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
