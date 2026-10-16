const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const callbacks = [];
let calls = 0;
let rows = [{ id: 'one' }];
let pending;
let sent = 0;
const context = vm.createContext({
  console, Blob, FormData, AbortController,
  crypto: { randomUUID: () => 'test-device' },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: {}, document: { hidden: false }, window: {},
  setTimeout, clearTimeout,
  setInterval: fn => { callbacks.push(fn); return callbacks.length; },
  clearInterval() {},
  fetch: async () => {
    calls++;
    if (pending) await pending;
    return { ok: true, status: 200, json: async () => rows };
  },
  XMLHttpRequest: class {
    constructor(){ this.upload = {}; this.status = 200; this.responseText = '{"id":"uploaded"}'; }
    open() {} setRequestHeader() {}
    send(){ sent++; assert.equal(this.timeout,60*60000); this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 }); this.upload.onload(); this.onload(); }
    abort(){ this.onabort(); }
  }
});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../api-data.js'), 'utf8'), context);
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  let renders = 0;
  const stop = context.pollFeed('/test', () => renders++, false);
  await settle();
  assert.equal(renders, 1);
  await callbacks[0]();
  assert.equal(renders, 1, 'Unchanged feeds must not rebuild cards');
  rows = [{ id: 'two' }];
  await callbacks[0]();
  assert.equal(renders, 2);
  let unblock;
  pending = new Promise(resolve => { unblock = resolve; });
  const first = callbacks[0]();
  const count = calls;
  await callbacks[0]();
  assert.equal(calls, count, 'Slow requests must not overlap');
  unblock(); await first; pending = null;
  context.window.__uploadsInFlight = 1;
  await callbacks[0]();
  assert.equal(calls, count, 'Feeds should pause during uploads');
  context.window.__uploadsInFlight = 0;
  context.document.hidden = true;
  await callbacks[0]();
  assert.equal(calls, count, 'Background tabs should not poll');
  context.document.hidden = false;
  stop(); await callbacks[0]();
  assert.equal(calls, count, 'Stopped listeners must not request data');
  const form = new FormData();
  form.append('file', new Blob(['test'], { type: 'image/png' }), 'test.png');
  const progress = [];
  const result = await context.api('/memories', { method: 'POST', form, onProgress: p => progress.push(p) });
  assert.equal(result.id, 'uploaded');
  assert.deepEqual(progress, [50, 100]);
  assert.equal(context.window.__uploadsInFlight, 0, 'Upload counter must clear after completion');
  const storyProgress = [];
  const storyResult = await context.addCoupleMemory(new Blob(['test'], {type:'image/png'}), 'Test caption', p => storyProgress.push(p));
  assert.equal(storyResult.id, 'uploaded');
  assert.deepEqual(storyProgress, [50, 100], 'Our Story uploads must forward transfer progress');
  // Override size on tiny Blobs to exercise boundaries without allocating 1 GB.
  const fakeForm=size=>{const blob=new Blob(['x'],{type:'video/mp4'});Object.defineProperty(blob,'size',{value:size});return {get:key=>key==='file'?blob:null};};
  await context.api('/admin/gallery',{method:'POST',form:fakeForm(257*1024*1024)});
  await context.api('/admin/gallery',{method:'POST',form:fakeForm(1024*1024*1024)});
  const beforeReject=sent;
  await assert.rejects(context.api('/admin/gallery',{method:'POST',form:fakeForm(1024*1024*1024+1)}),/1 GB/);
  await assert.rejects(context.api('/admin/competition-photos',{method:'POST',form:fakeForm(10*1024*1024+1)}),/10 MB/);
  await assert.rejects(context.api('/admin/bridal-train/photo',{method:'POST',form:fakeForm(10*1024*1024+1)}),/10 MB/);
  assert.equal(sent,beforeReject,'Oversized files must be rejected before network transfer');
  assert.equal(context.window.__uploadsInFlight,0);
  assert.match(context.uploadTransferLabel(25,{loaded:25*1024*1024,total:100*1024*1024,elapsedMs:10000}),/25\.0 \/ 100\.0 MB · 2\.50 MB\/s · about 30s left/);
  assert.equal(context.uploadTransferLabel(100),'100% sent — saving…');
  assert.equal(context.uploadTransferLabel(20),'Uploading 20%…');
  console.log('PASS: unchanged feeds, changed feeds, no overlap, pause/resume, unsubscribe, upload progress and counter cleanup');
})().catch(err => { console.error(err); process.exitCode = 1; });
