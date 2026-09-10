/** VELUNE server-only runner. Dry-run by default; one paid submission per receipt.
 * Original preparation files remain under velune-production/source.
 * No API key is read until --execute/--resume; no paid work is pre-approved.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUTPUT=path.join(ROOT,'studio','outputs');
const ENDPOINTS={video:'bytedance/seedance-2.5/reference-to-video',music:'fal-ai/elevenlabs/music',tts:'fal-ai/elevenlabs/tts/eleven-v3',sfx:'fal-ai/elevenlabs/sound-effects/v2'};
const json=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const load=async p=>json(path.resolve(ROOT,p));
const save=async(p,value)=>{await fs.mkdir(path.dirname(p),{recursive:true});const temp=p+'.tmp-'+randomUUID();await fs.writeFile(temp,JSON.stringify(value,null,2));await fs.rename(temp,p);};
const option=(argv,name)=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];};
const round=n=>Math.ceil(n*10000)/10000;
const inside=p=>{const resolved=path.resolve(ROOT,p);if(!resolved.startsWith(ROOT+path.sep))throw new Error('Project-relative path required.');return resolved;};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function estimate(task,input,guideSeconds=0){
 if(task==='video')return round((guideSeconds+Number(input.duration))*({'480p':.2205,'720p':.473,'1080p':1.164}[input.resolution])*(guideSeconds>0?.6:1));
 if(task==='music')return .6*Math.ceil(input.composition_plan.sections.reduce((n,s)=>n+s.duration_ms,0)/60000);
 if(task==='tts')return round([...input.text].length*.1/1000);
 return round(input.duration_seconds*.002);
}
export function validatePlan(task,input){
 if(task==='music'){
  const sections=input.composition_plan.sections;
  if(!sections.length||sections.some(s=>!Number.isInteger(s.duration_ms)||s.duration_ms<3000||s.duration_ms>120000||!Array.isArray(s.lines)||s.lines.length))throw new Error('Instrumental music needs 3–120s sections and empty lyric arrays.');
  if(sections.reduce((n,s)=>n+s.duration_ms,0)!==15000)throw new Error('Score must total exactly 15000ms.');
 }
 if(task==='tts'&&(!input.text.trim()||input.text.length>5000))throw new Error('Invalid narration text.');
 if(task==='sfx'&&(!Number.isFinite(input.duration_seconds)||input.duration_seconds<.5||input.duration_seconds>22))throw new Error('SFX duration must be 0.5–22s.');
 if(task==='video'&&(!Number.isInteger(Number(input.duration))||Number(input.duration)<4||Number(input.duration)>30||!['480p','720p','1080p'].includes(input.resolution)))throw new Error('Video needs 4–30 whole seconds and a documented resolution.');
}
function inspectGuide(p,frames){
 const r=spawnSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',p],{encoding:'utf8'});
 if(r.error||r.status!==0)throw new Error('ffprobe must validate the approved guide: '+(r.error?.message||r.stderr));
 const v=JSON.parse(r.stdout).streams.find(s=>s.codec_type==='video');
 const [a,b]=(v?.avg_frame_rate||'0/1').split('/').map(Number);
 if(!v||a/b!==24||Number(v.nb_read_frames)!==frames)throw new Error(`Guide needs ${frames} decoded frames at24fps.`);
 if(v.width<300||v.height<300||v.width>6000||v.height>6000||v.width/v.height<.4||v.width/v.height>2.5)throw new Error('Guide dimensions violate Seedance limits.');
 return frames/24;
}
export async function plan(argv){
 const task=argv[0];let input,uploads=[],label=task,guideSeconds=0,job=null;
 if(!ENDPOINTS[task])throw new Error('Choose video, music, tts VO01 --voice NAME, or sfx FX01.');
 if(task==='video'){
  job=await load(option(argv,'--job')||'studio/video_job.json');
  if(job.endpoint!==ENDPOINTS.video)throw new Error('Endpoint change needs a fresh provider review.');
  input={...job.input,prompt:await fs.readFile(inside(job.prompt_file),'utf8')};
  const frames=job.guide_frames??360;
  if(![360,96].includes(frames))throw new Error('Use the360-frame master or96-frame/4s repair guide.');
  if((frames===360&&Number(input.duration)!==15)||(frames===96&&Number(input.duration)!==4))throw new Error('Output duration must match this guide plan.');
  guideSeconds=frames/24;
  uploads=[{kind:'video_urls',local:inside(job.guide),frames},...job.image_paths.map(p=>({kind:'image_urls',local:inside(p)}))];
  if(job.image_paths.length>30)throw new Error('At most30 image references.');
  if(uploads.some(u=>u.local.includes('source_choreography_index')))throw new Error('Source choreography artwork is not an appearance input.');
  label=job.shot||'video';
 }else if(task==='music')input={composition_plan:await load('studio/music_composition_plan.json'),respect_sections_durations:true,output_format:'mp3_44100_128'};
 else if(task==='tts'){
  const j=await load('studio/narration.json');const line=j.lines.find(x=>x.id===argv[1]);
  if(!line)throw new Error('Choose VO01–VO04.');
  input={text:line.text,voice:option(argv,'--voice')||j.voice,stability:.5,timestamps:true,language_code:'en',apply_text_normalization:'auto'};label=line.id;
 }else{
  const effect=(await load('studio/sfx_cues.json')).find(x=>x.id===argv[1]);if(!effect)throw new Error('Choose FX01–FX10.');
  input={text:effect.prompt,duration_seconds:effect.generation_duration_seconds,prompt_influence:.5,output_format:'mp3_44100_128',loop:false};label=effect.id;
 }
 validatePlan(task,input);
 for(const u of uploads){try{const bytes=await fs.readFile(u.local);u.sha256=hash(bytes);u.bytes=bytes.length;}catch(e){if(e.code!=='ENOENT')throw e;u.missing=true;}}
 const estimatedCost=estimate(task,input,guideSeconds);
 const fingerprint=hash(JSON.stringify({endpoint:ENDPOINTS[task],input,uploads:uploads.map(({local,sha256})=>({path:path.relative(ROOT,local),sha256}))}));
 return{task,label,endpoint:ENDPOINTS[task],input,uploads,guideSeconds,job,estimated_cost_usd:estimatedCost,budget_reserve_usd:round(estimatedCost*1.25),fingerprint};
}
export function checkApproval(approval,p,records){
 if(approval.approved!==true||approval.camera_approved!==true)throw new Error('Camera review and explicit spending approval are required.');
 if(!approval.allowed_fingerprints?.includes(p.fingerprint))throw new Error('This exact input plan is not approved; inspect its dry run.');
 if(p.uploads.length&&approval.upload_approved!==true)throw new Error('Asset upload is not approved.');
 if(p.task==='video'&&p.job.approved!==true)throw new Error('The video job has no camera approval.');
 const used=records.reduce((n,r)=>n+(r.budget_reserve_usd||0),0);
 if(!Number.isFinite(approval.ceiling_usd)||used+p.budget_reserve_usd>approval.ceiling_usd)throw new Error('Remaining approved planning budget is insufficient.');
 if(records.some(r=>r.fingerprint===p.fingerprint))throw new Error('This plan already has a receipt. Resume it; authorize a distinct take only after review.');
}
function queueURL(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.hostname!=='queue.fal.run')throw new Error('Unrecognized queue URL; credentials were not sent.');return u;}
async function request(url,{method='GET',body}={}){
 const response=await fetch(queueURL(url),{method,redirect:'error',headers:{Authorization:`Key ${process.env.FAL_KEY}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
 if(!response.ok){const err=new Error(`fal queue HTTP${response.status}; inspect the saved request before retrying.`);err.status=response.status;throw err;}
 return response.json();
}
export async function pollReceipt(record,requestFn=request){
 if(!record.request_id)throw new Error('No saved request ID. Check the fal dashboard; never blindly repeat this submission.');
 if((record.status==='completed'&&record.result)||record.status==='failed')return record;
 const status=await requestFn(record.status_url);
 if(status.status!=='COMPLETED')return{...record,status:status.status||'pending',last_checked_at:new Date().toISOString()};
 if(status.error)return{...record,status:'failed',provider_error:status.error,provider_error_type:status.error_type||null,last_checked_at:new Date().toISOString()};
 const result=await requestFn(record.response_url);
 return{...record,status:'completed',result,last_checked_at:new Date().toISOString()};
}
async function resume(receiptPath){
 const file=inside(receiptPath),record=await json(file);
 if(!Object.values(ENDPOINTS).includes(record.endpoint))throw new Error('Receipt endpoint is not allowed.');
 try{const updated=await pollReceipt(record);await save(file,updated);console.log(JSON.stringify({receipt:file,status:updated.status,request_id:updated.request_id,result:updated.result||null},null,2));}
 catch(e){await save(file,{...record,last_poll_error:e.message,last_checked_at:new Date().toISOString()});throw new Error(`${e.message} Receipt retained. --resume only checks this existing job; it never submits another.`);}
}
export async function main(argv=process.argv.slice(2)){
 const resumePath=option(argv,'--resume');
 if(resumePath){if(!process.env.FAL_KEY)throw new Error('FAL_KEY must be configured server-side.');await resume(resumePath);return;}
 const p=await plan(argv);
 if(!argv.includes('--execute')){console.log(JSON.stringify({status:'DRY RUN: no upload, request or charge',...p},null,2));return;}
 if(!process.env.FAL_KEY)throw new Error('FAL_KEY must be configured server-side; never paste credentials into the pack.');
 if(p.task==='tts'&&(!p.input.voice||p.input.voice==='UNSELECTED'))throw new Error('Select an authorized stock voice before execution.');
 for(const u of p.uploads){if(u.missing)throw new Error(`Missing approved input: ${path.relative(ROOT,u.local)}`);if(u.kind==='video_urls'){inspectGuide(u.local,u.frames);if(u.bytes>200*1024*1024)throw new Error('Guide exceeds200MB.');}else if(u.bytes>30*1024*1024)throw new Error('Image exceeds30MB.');}
 await fs.mkdir(OUTPUT,{recursive:true});const lock=path.join(OUTPUT,'.submission.lock');
 try{await fs.mkdir(lock);}catch{throw new Error('A submission lock exists. Check saved receipts and running work before clearing a stale lock.');}
 try{
  const files=(await fs.readdir(OUTPUT)).filter(f=>f.endsWith('.receipt.json'));const records=await Promise.all(files.map(f=>json(path.join(OUTPUT,f))));
  const approval=await load('studio/spending_approval.json');checkApproval(approval,p,records);
  const id=`${p.label}_${new Date().toISOString().replace(/[:.]/g,'-')}`;const receipt=path.join(OUTPUT,id+'.receipt.json');
  let r={...p,job:undefined,input:p.input,status:'prepared',created_at:new Date().toISOString(),actual_cost_usd:null,approval_note:approval.note};
  await save(receipt,r);
  if(p.uploads.length){
   const {fal}=await import('@fal-ai/client');
   for(const u of p.uploads){
    const bytes=await fs.readFile(u.local);if(hash(bytes)!==u.sha256)throw new Error('Approved asset changed during submission.');
    const types={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime'};
    const url=await fal.storage.upload(new File([bytes],path.basename(u.local),{type:types[path.extname(u.local).toLowerCase()]||'application/octet-stream'}));
    (p.input[u.kind]??=[]).push(url);r={...r,input:p.input};await save(receipt,r);
   }
  }
  r={...r,status:'submission_started'};await save(receipt,r);
  let accepted;
  try{accepted=await request(`https://queue.fal.run/${p.endpoint}`,{method:'POST',body:p.input});}
  catch(e){await save(receipt,{...r,status:'submission_unknown',last_error:e.message});throw new Error(`Submission outcome uncertain. Receipt:${receipt}. Do not resubmit; inspect fal dashboard.`);}
  if(!accepted.request_id||!accepted.status_url||!accepted.response_url){await save(receipt,{...r,status:'submission_unknown',provider_response:accepted});throw new Error('Incomplete queue response; inspect the saved receipt and fal dashboard.');}
  r={...r,status:'accepted',request_id:accepted.request_id,status_url:accepted.status_url,response_url:accepted.response_url};await save(receipt,r);
  console.log(JSON.stringify({receipt,status:'accepted',request_id:r.request_id,resume:`node studio/fal_runner.mjs --resume '${path.relative(ROOT,receipt)}'`,estimated_cost_usd:p.estimated_cost_usd},null,2));
 }finally{await fs.rmdir(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
