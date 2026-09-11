// Run: node scripts/check-campaign-transfer.cjs
// Executes the real transport with mocked browser storage/network; no provider generation calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");

// A transaction-local store verifies rollback: a quota failure cannot evict older records.
function mockStorage() {
  const records = new Map();
  let quota = false;
  const db = {
    objectStoreNames: { contains: () => true }, close() {},
    transaction() {
      const draft = structuredClone(records);
      let tasks = 0, ended = false;
      const tx = { error: null, oncomplete: null, onabort: null, onerror: null,
        abort() { if (!ended) { ended = true; queueMicrotask(() => tx.onabort?.()); } },
      };
      function completeLater() {
        setTimeout(() => {
          if (tasks || ended) return;
          ended = true;
          records.clear();
          for (const [key, value] of draft) records.set(key, value);
          tx.oncomplete?.();
        }, 0);
      }
      function task(run) {
        const request = { result: undefined, onsuccess: null };
        tasks++;
        queueMicrotask(() => {
          if (!ended) { request.result = run(); request.onsuccess?.(); }
          tasks--; completeLater();
        });
        return request;
      }
      tx.objectStore = () => ({
        getAll: () => task(() => [...draft.values()]),
        get: (id) => task(() => draft.get(id)),
        delete: (id) => { draft.delete(id); },
        put: (record) => {
          if (quota) { tx.error = { name: "QuotaExceededError" }; tx.abort(); }
          else draft.set(record.id, structuredClone(record));
        },
      });
      completeLater();
      return tx;
    },
  };
  return { records, setQuota: (value) => { quota = value; }, indexedDB: {
    open() { const request = { result: db, onsuccess: null }; queueMicrotask(() => request.onsuccess?.()); return request; },
  } };
}

const storage = mockStorage();
const moduleObject = { exports: {} };
let now = 1_800_000_000_000, fetches = 0, lastFetch;
let responseFactory;
class Clock extends Date { static now() { return now; } }
const context = {
  module: moduleObject, exports: moduleObject.exports, require: () => ({}),
  Date: Clock, URL, URLSearchParams, Blob, Uint8Array, ArrayBuffer, AbortController,
  FileReader: class {}, Response, ReadableStream, atob, setTimeout, clearTimeout, crypto: { randomUUID },
  indexedDB: storage.indexedDB,
  fetch: async (url, options) => { fetches++; lastFetch = [url, options]; return responseFactory(); },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../src/lib/campaignHandoff.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const h = moduleObject.exports;
const clean = (value) => JSON.parse(JSON.stringify(value));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
const source = `data:image/png;base64,${png.toString("base64")}`;
const meta = { name: "Cookies · Front", angle: "front", source: "artwork", variant: "Local artwork render", review: "needs-review", note: "Front assigned; check crop and labels." };

async function main() {
  for (const id of [undefined, "", "../../secret", "<script>", randomUUID().replace(/-/g, ""), [randomUUID()]]) assert(!h.validCampaignHandoffId(id));
  assert(h.validCampaignHandoffId(randomUUID()));
  assert.deepEqual(clean(h.readCampaignPackshotMeta(meta)), meta);
  for (const bad of [null, [], { ...meta, angle: ["front"] }, { ...meta, review: "approved-by-AI" }, { ...meta, source: "raw-upload" },
    { ...meta, name: "" }, { ...meta, variant: "x".repeat(181) }, { ...meta, note: "bad\u0000note" }, { ...meta, reviewedAt: "not a date" }]) {
    assert.throws(() => h.readCampaignPackshotMeta(bad));
  }
  for (const url of ["https://fal.media/x", "https://v3b.fal.media/x", "https://api.recraft.ai/x", "https://foo.public.blob.vercel-storage.com/x"]) assert(h.isCampaignProviderUrl(url));
  for (const url of ["http://fal.media/x", "https://fakefal.media/x", "https://fal.media.evil.test/x", "https://evil.test/x", "https://fal.media:8443/x", "https://x@y.fal.media/x", "data:image/svg+xml,foo", "blob:https://fal.media/x"]) assert(!h.isCampaignProviderUrl(url));
  await h.validateCampaignImage(new Blob([png], { type: "image/png" }));
  await h.validateCampaignImage(new Blob([new Uint8Array([255, 216, 255, 224])], { type: "image/jpeg" }));
  await h.validateCampaignImage(new Blob(["RIFF1234WEBP"], { type: "image/webp" }));
  for (const image of [new Blob(["<svg></svg>"], { type: "image/svg+xml" }), new Blob([png], { type: "image/jpeg" }), new Blob(["not a PNG"], { type: "image/png" }), new Blob([], { type: "image/png" }), new Blob([new Uint8Array(h.CAMPAIGN_HANDOFF_MAX_BYTES + 1)], { type: "image/png" })]) {
    await assert.rejects(h.validateCampaignImage(image));
  }

  const first = await h.saveCampaignHandoff(source, meta);
  assert.equal(fetches, 0, "local artwork never calls any server");
  assert.equal(first.expiresAt - first.createdAt, h.CAMPAIGN_HANDOFF_TTL);
  assert.deepEqual(clean(first.meta), meta);
  assert.equal(first.blob.type, "image/png");
  assert.deepEqual(Buffer.from(await first.blob.arrayBuffer()), png);
  const loaded = await h.loadCampaignHandoff(first.id);
  assert.deepEqual(clean(loaded.meta), meta);
  assert.deepEqual(Buffer.from(await loaded.blob.arrayBuffer()), png);
  assert.equal(await h.loadCampaignHandoff(randomUUID()), null);
  assert.equal(await h.loadCampaignHandoff("not-an-id"), null);
  meta.name = "Changed after send";
  assert.notEqual((await h.loadCampaignHandoff(first.id)).meta.name, meta.name, "stored metadata is a snapshot");

  now += h.CAMPAIGN_HANDOFF_TTL + 1;
  assert.equal(await h.loadCampaignHandoff(first.id), null);
  assert(!storage.records.has(first.id), "expired bytes are removed when requested");
  const saved = [];
  for (let i = 0; i < 10; i++) { now++; saved.push(await h.saveCampaignHandoff(source, meta)); }
  assert.equal(storage.records.size, 8);
  assert(!storage.records.has(saved[0].id));
  assert(!storage.records.has(saved[1].id));
  assert(storage.records.has(saved[9].id));
  const ids = [...storage.records.keys()];
  storage.setQuota(true);
  await assert.rejects(h.saveCampaignHandoff(source, meta), /no room/);
  assert.deepEqual([...storage.records.keys()], ids, "failed writes preserve existing handoffs");
  storage.setQuota(false);
  const corrupted = storage.records.get(saved[2].id);
  storage.records.set(corrupted.id, { ...corrupted, version: 99 });
  await assert.rejects(h.loadCampaignHandoff(corrupted.id), /invalid/);

  responseFactory = () => new Response(png, { headers: { "content-type": "image/png" } });
  const hosted = await h.saveCampaignHandoff("https://v3b.fal.media/completed.png", { ...meta, source: "generated", review: "reviewed", reviewedAt: new Date(now).toISOString(), model: "Example model" });
  assert.equal(fetches, 1);
  assert(lastFetch[0].startsWith("/api/packshot-file?"), "uses the existing same-origin download proxy");
  assert.equal(new URL(lastFetch[0], "https://example.test").searchParams.get("url"), "https://v3b.fal.media/completed.png");
  assert.equal(lastFetch[1].cache, "no-store");
  assert.deepEqual(Buffer.from(await hosted.blob.arrayBuffer()), png);
  assert(!("url" in hosted), "provider URLs are not stored");
  const beforeReject = fetches;
  await assert.rejects(h.saveCampaignHandoff("https://evil.test/image.png", meta), /not from a supported/);
  await assert.rejects(h.saveCampaignHandoff("data:image/svg+xml;base64,PHN2Zz4=", meta), /invalid/);
  await assert.rejects(h.saveCampaignHandoff("data:image/png;base64,%%%%", meta), /invalid/);
  assert.equal(fetches, beforeReject);
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(h.saveCampaignHandoff(source, meta, { signal: aborted.signal }), /cancelled/);

  responseFactory = () => new Response("too big", { headers: { "content-type": "image/png", "content-length": String(h.CAMPAIGN_HANDOFF_MAX_BYTES + 1) } });
  await assert.rejects(h.saveCampaignHandoff("https://fal.media/oversize.png", meta), /exceeds 24 MB/);
  let streamCancelled = false;
  responseFactory = () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(h.CAMPAIGN_HANDOFF_MAX_BYTES)); controller.enqueue(new Uint8Array([1])); }, cancel() { streamCancelled = true; } }), { headers: { "content-type": "image/png" } });
  await assert.rejects(h.saveCampaignHandoff("https://fal.media/stream.png", meta), /exceeds 24 MB/);
  assert(streamCancelled, "oversize streams are cancelled rather than fully downloaded");
  responseFactory = () => new Response("<html>Error</html>", { headers: { "content-type": "text/html" } });
  await assert.rejects(h.saveCampaignHandoff("https://fal.media/error.png", meta), /not PNG/);
  responseFactory = () => new Response("failure", { status: 503 });
  await assert.rejects(h.saveCampaignHandoff("https://fal.media/error.png", meta), /503/);

  console.log("Campaign transfer checks passed: metadata and raster validation, provider boundaries, exact bytes, same-browser restore, expiry, retention, quota rollback, malformed records, cancellation, and bounded proxy downloads. No generation calls.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
