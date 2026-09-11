// No real credentials, network calls, uploads, or paid submissions.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript');
const { ValidationError, ApiError } = require(root + '/node_modules/@fal-ai/client');
let checks = 0, statusCalls = 0, resultCalls = 0, submissions = 0, statusError, resultError, status = 'COMPLETED';
let resultData = { video: { url: 'https://media.example/finished.mp4' } };
const check = (value, label) => { assert(value, label); checks++; };
function load(file, deps) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { if (Object.hasOwn(deps, name)) return deps[name]; throw new Error('Unexpected dependency: ' + name); }, process: { env: { FAL_KEY: 'synthetic-test-key' } }, console: { error() {} }, Error, URL, Blob, Request, Response, fetch: () => { throw new Error('Network forbidden'); } }, { filename: file });
  return exports;
}
const fal = {
  config() {},
  queue: {
    submit: async () => { submissions++; throw new Error('Submission forbidden'); },
    status: async () => { statusCalls++; if (statusError) throw statusError; return { status }; },
    result: async () => { resultCalls++; if (resultError) throw resultError; return { data: resultData }; },
  },
};
const api = load('src/lib/fal.ts', { 'server-only': {}, '@fal-ai/client': { fal } });
const route = load('src/app/api/generate/video/status/route.ts', { 'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } }, '@/lib/fal': api, '@/lib/gemini': { pollVeo: () => { throw new Error('Wrong provider'); } }, '@/lib/models': { getModel: () => ({ endpoint: 'bytedance/seedance-2.5/reference-to-video' }) } });
const requestId = 'existing-video-request';
const post = () => route.POST(new Request('https://studio.example/api/generate/video/status', { method: 'POST', body: JSON.stringify({ provider: 'fal', modelId: 'seedance-2.5-ref', falRequestId: requestId }) }));
const validation = detail => new ValidationError({ status: 422, message: 'Unprocessable Entity', requestId, body: { detail } });
(async () => {
  resultError = validation([{ loc: ['body', 'video_urls', 0], type: 'value_error', msg: 'Reference video dimensions are invalid', input: 'PRIVATE_INPUT_MUST_NOT_BE_SHOWN' }]);
  let response = await post(), result = await response.json();
  check(response.status === 200 && result.status === 'failed', 'Result-stage 422 is a terminal provider rejection');
  check(result.error.includes('video_urls.0') && result.error.includes('Reference video dimensions are invalid'), 'Result-stage failure preserves the rejected field and provider message');
  check(result.error.includes(requestId), 'Existing request ID remains visible for support');
  check(!result.error.includes('PRIVATE_INPUT_MUST_NOT_BE_SHOWN'), 'Error display excludes the rejected input payload');
  statusError = resultError; resultError = undefined;
  const before = resultCalls; result = await (await post()).json();
  check(result.error.includes('video_urls.0') && resultCalls === before, 'Status-stage 422 also preserves details without trying result');
  statusError = undefined;
  resultError = validation([{ loc: ['body', 'image_urls'], type: 'content_policy_violation', msg: 'Partner could not process these references.', ctx: { extra_info: { reason: 'partner_validation_failed' } } }]);
  result = await (await post()).json();
  check(result.error.includes('content_policy_violation') && result.error.includes('Partner could not process these references.'), 'Policy failure retains its category and actual provider message');
  check(!result.error.includes('decoded and looked at') && !result.error.includes('packaging and product photography tend'), 'No unsupported claims about the filter cause or decoding');
  resultError = validation('Reference video could not be decoded');
  check((await (await post()).json()).error.includes('Reference video could not be decoded'), 'String detail bodies remain actionable');
  resultError = validation([null, { loc: ['body', 'image_urls'], type: 'value_error', msg: 'Invalid image' }]);
  check((await (await post()).json()).error.includes('Invalid image'), 'Malformed detail entry cannot hide valid details');
  resultError = new ValidationError({ status: 422, message: 'Unprocessable Entity', body: { input: 'PRIVATE_INPUT_MUST_NOT_BE_SHOWN' } });
  result = await (await post()).json();
  check(result.error.includes('without field details') && !result.error.includes('PRIVATE_INPUT'), 'Missing detail falls back safely, without echoing raw request body');
  for (const stage of ['status', 'result']) {
    for (const error of [new ApiError({ status: 503, message: 'Temporary provider outage' }), new ApiError({ status: 429, message: 'Rate limit' }), new ApiError({ status: 408, message: 'Timeout' }), new Error('Network disconnected')]) {
      statusError = stage === 'status' ? error : undefined; resultError = stage === 'result' ? error : undefined;
      response = await post(); result = await response.json();
      check(response.status === 503 && result.status === 'pending' && result.error.includes(requestId), stage + ' temporary errors retain the existing generation handle');
    }
  }
  statusError = undefined; resultError = new ApiError({ status: 403, message: 'Forbidden' });
  result = await (await post()).json();
  check(result.status === 'failed' && result.error.includes('model') && !result.error.includes('refused the upload'), 'Generation permission error is not mislabeled as a storage failure');
  resultError = undefined; status = 'IN_PROGRESS';
  const waitingCalls = resultCalls; result = await (await post()).json();
  check(result.status === 'pending' && resultCalls === waitingCalls, 'Running jobs are not collected prematurely');
  status = 'COMPLETED'; result = await (await post()).json();
  check(result.status === 'done' && result.videoUrl === resultData.video.url, 'Completed video still returned normally');
  resultData = { videos: [{ url: 'https://media.example/alternate.mp4' }] }; result = await (await post()).json();
  check(result.status === 'done' && result.videoUrl === resultData.videos[0].url, 'Alternate video result shape retained');
  resultData = {}; result = await (await post()).json();
  check(result.status === 'failed' && result.error.includes(requestId), 'Missing output includes the request ID');
  check(statusCalls > 0 && submissions === 0, 'All checks poll existing jobs; none submit generations');
  console.log(`PASS: ${checks} provider-detail, queued failure, transient recovery and no-resubmission checks. No paid calls.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
