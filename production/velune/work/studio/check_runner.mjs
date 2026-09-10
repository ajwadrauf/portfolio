/** Offline tests: no provider SDK, credentials, uploads or generation calls. */
import assert from 'node:assert/strict';
import {plan,estimate,validatePlan,checkApproval,pollReceipt} from './fal_runner.mjs';
const music=await plan(['music']);assert.equal(music.estimated_cost_usd,.6);assert.equal(music.input.composition_plan.sections.reduce((n,s)=>n+s.duration_ms,0),15000);
const bad=structuredClone(music.input);bad.composition_plan.sections[0].lines=['Narration must not become a lyric'];assert.throws(()=>validatePlan('music',bad));
const tooShort=structuredClone(music.input);tooShort.composition_plan.sections[0].duration_ms=500;assert.throws(()=>validatePlan('music',tooShort));
assert.equal(estimate('video',{duration:'15',resolution:'720p'},15),8.514);assert.equal(estimate('video',{duration:'4',resolution:'720p'},4),2.2704);assert.equal(estimate('video',{duration:'15',resolution:'480p'},15),3.969);
for(const duration of [.49,22.1,NaN])assert.throws(()=>validatePlan('sfx',{duration_seconds:duration}));
const voice=await plan(['tts','VO03','--voice','Rachel']);assert.equal(voice.input.text,'Velune. The Centre Report.');assert.equal(voice.input.timestamps,true);assert.ok(!('speed' in voice.input));
const approval={approved:true,camera_approved:true,upload_approved:true,ceiling_usd:2,allowed_fingerprints:[music.fingerprint]};checkApproval(approval,music,[]);
assert.throws(()=>checkApproval({...approval,approved:false},music,[]));assert.throws(()=>checkApproval({...approval,camera_approved:false},music,[]));assert.throws(()=>checkApproval({...approval,allowed_fingerprints:[]},music,[]));assert.throws(()=>checkApproval({...approval,ceiling_usd:.7},music,[]));assert.throws(()=>checkApproval(approval,music,[{fingerprint:music.fingerprint,budget_reserve_usd:.75}]));
const receipt={request_id:'test-request',endpoint:music.endpoint,status:'accepted',status_url:'https://queue.fal.run/test/status',response_url:'https://queue.fal.run/test/result'};
let calls=[];const failing=async url=>{calls.push(url);throw new Error('503');};await assert.rejects(pollReceipt(receipt,failing));await assert.rejects(pollReceipt(receipt,failing));assert.deepEqual(calls,[receipt.status_url,receipt.status_url]);
const pending=await pollReceipt(receipt,async()=>({status:'IN_QUEUE'}));assert.equal(pending.request_id,receipt.request_id);assert.equal(pending.status,'IN_QUEUE');
const failed=await pollReceipt(receipt,async()=>({status:'COMPLETED',error:'Provider rejected the input',error_type:'validation_error'}));assert.equal(failed.status,'failed');assert.equal(failed.provider_error_type,'validation_error');
const complete=await pollReceipt(receipt,async url=>url.endsWith('/status')?{status:'COMPLETED'}:{audio:{url:'https://example.invalid/completed.mp3'}});assert.equal(complete.status,'completed');assert.equal(complete.result.audio.url,'https://example.invalid/completed.mp3');
await pollReceipt(complete,async()=>{throw new Error('A completed receipt must not poll again.');});
console.log('PASS: current cost math, instrumental sections, voice fields, duration validation, explicit approval, budget and duplicate guards, transient polling recovery, completed receipt reuse. No network calls.');
