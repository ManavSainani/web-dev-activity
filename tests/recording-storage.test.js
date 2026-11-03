import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { Upload } from 'tus-js-client';
import { saveRecording } from '../app/recording-storage.js';
import { parseRecordingDetails, MAX_FILE_BYTES } from '../lib/recording-details.js';

afterEach(() => mock.restoreAll());
const input = () => ({
  id: crypto.randomUUID(), sessionId: 'FN\u2014ABC123', title: 'Interview',
  mode: 'video', startedAt: '2026-11-03T12:00:00.000Z', durationMs: 1200,
  blob: new Blob(['video'], { type: 'video/webm;codecs=vp9,opus' }),
  mimeType: 'video/webm;codecs=vp9,opus',
});
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const prepared = { id: crypto.randomUUID(), path: 'owner/video.webm', uploadToken: 'signed', uploadEndpoint: 'https://example.com/storage/v1/upload/resumable' };

test('saves captured session ID and video, finalizing only after upload succeeds', async () => {
  const record = input();
  const events = [];
  mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    events.push(url);
    if (url.endsWith('/prepare')) {
      assert.equal(body.sessionId, record.sessionId);
      assert.equal(body.id, record.id);
      assert.equal(body.contentType, 'video/webm');
      assert.equal(body.fileSizeBytes, record.blob.size);
      assert.equal(body.durationSeconds, 2);
      return response(prepared);
    }
    assert.deepEqual(body, { id: prepared.id });
    return response({ ok: true });
  });
  mock.method(Upload.prototype, 'start', function () {
    assert.equal(this.file, record.blob);
    assert.equal(this.options.headers['x-signature'], 'signed');
    assert.equal(this.options.chunkSize, 6 * 1024 * 1024);
    assert.equal(JSON.parse(this.options.metadata.metadata).sessionId, record.sessionId);
    events.push('upload');
    this.options.onProgress(5, 5);
    this.options.onSuccess();
  });
  const progress = [];
  await saveRecording(record, (percent) => progress.push(percent));
  assert.deepEqual(events, ['/api/recordings/prepare', 'upload', '/api/recordings/complete']);
  assert.deepEqual(progress, [100]);
});

test('retries finalization without uploading a second video', async () => {
  const record = input();
  let attempts = 0;
  mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/prepare')) return response(prepared);
    attempts++;
    return attempts === 1 ? response({ error: 'Please retry.' }, 503) : response({ ok: true });
  });
  const upload = mock.method(Upload.prototype, 'start', function () { this.options.onSuccess(); });
  await assert.rejects(saveRecording(record), /Please retry/);
  await saveRecording(record);
  assert.equal(upload.mock.callCount(), 1);
  assert.equal(attempts, 2);
});

test('failed upload remains retryable and cannot finalize prematurely', async () => {
  const record = input();
  let completed = false;
  mock.method(globalThis, 'fetch', async (url) => {
    if (url.endsWith('/complete')) completed = true;
    return response(url.endsWith('/prepare') ? prepared : { ok: true });
  });
  let attempts = 0;
  mock.method(Upload.prototype, 'start', function () {
    if (++attempts === 1) this.options.onError(new Error('offline'));
    else this.options.onSuccess();
  });
  await assert.rejects(saveRecording(record), /interrupted/);
  assert.equal(completed, false);
  await saveRecording(record);
  assert.equal(completed, true);
});

test('unauthorized saves show the server error without uploading', async () => {
  mock.method(globalThis, 'fetch', async () => response({ error: 'Enter a new key.' }, 401));
  const upload = mock.method(Upload.prototype, 'start', () => assert.fail('Unauthorized upload'));
  await assert.rejects(saveRecording(input()), /Enter a new key/);
  assert.equal(upload.mock.callCount(), 0);
});

test('server validates session IDs, type, size, and one-hour video duration', () => {
  const record = input();
  const body = { ...record, contentType: 'video/webm', durationSeconds: 3600, fileSizeBytes: 5 };
  assert.equal(parseRecordingDetails(body).session_id, record.sessionId);
  for (const override of [
    { sessionId: 'invalid' }, { id: '../invalid' }, { durationSeconds: 3601 },
    { durationSeconds: -1 }, { fileSizeBytes: MAX_FILE_BYTES + 1 },
    { fileSizeBytes: 0 }, { contentType: 'audio/webm' }, { startedAt: 'invalid' },
    { mode: '__proto__' },
  ]) assert.throws(() => parseRecordingDetails({ ...body, ...override }));
});
