import { Upload } from 'tus-js-client';

async function post(path, body) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not save recording. Please retry.');
  return result;
}

// Keep upload state so a failed finalization can retry without another upload.
const pending = new Map();
export function discardRecording(id) {
  const state = pending.get(id);
  if (state?.upload && !state.uploaded) state.upload.abort().catch(() => {});
  pending.delete(id);
}

export async function saveRecording(record, onProgress = () => {}) {
  let state = pending.get(record.id);
  if (!state) {
    const prepared = await post('/api/recordings/prepare', {
      id: record.id, sessionId: record.sessionId, title: record.title,
      mode: record.mode, startedAt: record.startedAt,
      durationSeconds: Math.ceil(record.durationMs / 1000),
      fileSizeBytes: record.blob.size, contentType: record.mimeType.split(';')[0],
    });
    state = { ...prepared, uploaded: prepared.saved, saved: prepared.saved };
    pending.set(record.id, state);
  }
  if (state.saved) return;
  if (!state.uploaded) {
    await new Promise((resolve, reject) => {
      if (!state.upload) state.upload = new Upload(record.blob, {
        endpoint: state.uploadEndpoint,
        headers: { 'x-signature': state.uploadToken },
        chunkSize: 6 * 1024 * 1024,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        storeFingerprintForResuming: false,
        metadata: {
          bucketName: 'recordings', objectName: state.path,
          contentType: record.mimeType.split(';')[0],
          metadata: JSON.stringify({ sessionId: record.sessionId }),
        },
      });
      state.upload.options.onProgress = (sent, total) => onProgress(Math.floor(sent / total * 100));
      state.upload.options.onError = () => reject(new Error('Video upload interrupted. Check your connection and retry Save.'));
      state.upload.options.onSuccess = () => { state.uploaded = true; resolve(); };
      state.upload.start();
    });
  }
  await post('/api/recordings/complete', { id: state.id });
  pending.delete(record.id);
}
