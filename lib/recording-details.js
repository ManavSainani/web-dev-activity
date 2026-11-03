export const MAX_FILE_BYTES = 500 * 1024 * 1024;
export const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TYPES = { video: new Set(['video/webm', 'video/mp4']), audio: new Set(['audio/webm', 'audio/mp4']) };

export function parseRecordingDetails(body) {
  if (!body || typeof body !== 'object') throw new Error('Invalid recording details.');
  const { id, sessionId, mode, contentType, durationSeconds, fileSizeBytes, startedAt } = body;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id) ||
      typeof sessionId !== 'string' || !/^FN\u2014[A-F0-9]{6}$/.test(sessionId) ||
      !Object.hasOwn(TYPES, mode) || !TYPES[mode].has(contentType) ||
      !Number.isInteger(durationSeconds) || durationSeconds < 0 ||
      durationSeconds > (mode === 'video' ? 3600 : 21600) ||
      !Number.isInteger(fileSizeBytes) || fileSizeBytes < 1 || fileSizeBytes > MAX_FILE_BYTES ||
      typeof startedAt !== 'string' || !Number.isFinite(Date.parse(startedAt))) {
    throw new Error('Invalid recording details. Videos must be at most 1 hour and uploads at most 500 MB.');
  }
  return {
    id, session_id: sessionId, mode, content_type: contentType,
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 120) || `${mode === 'video' ? 'Video' : 'Audio'} recording` : `${mode === 'video' ? 'Video' : 'Audio'} recording`,
    duration_seconds: durationSeconds, file_size_bytes: fileSizeBytes,
    started_at: new Date(startedAt).toISOString(),
  };
}
