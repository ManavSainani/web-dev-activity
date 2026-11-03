import { saveRecording, discardRecording } from './recording-storage';

let initialized = false;
const MAX_VIDEO_DURATION_MS = 60 * 60 * 1000;

export function initializeRecorder() {
  if (initialized) return;
  initialized = true;
  const $ = (selector) => document.querySelector(selector);
  const modeButtons = [...document.querySelectorAll('.mode-button')];
  const recordButton = $('#recordButton');
  const recordLabel = $('#recordLabel');
  const saveButton = $('#saveButton');
  const status = $('#status');
  const statusText = status.querySelector('span');
  const preview = $('#livePreview');
  const placeholder = $('#stagePlaceholder');
  const title = $('#stageTitle');
  const description = $('#stageDescription');
  const icon = $('#stageIcon');
  const overlay = $('#recordingOverlay');
  const timer = $('#timer');
  const toast = $('#toast');
  const sessionId = $('#sessionId');
  let mode = 'video';
  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordingBlob = null;
  let recordingUrl = null;
  let completedRecording = null;
  let activeSessionId = null;
  let saving = false;
  let starting = false;
  let timerInterval = null;
  let recordingLimitTimeout = null;
  let startedAt = 0;
  const facingMode = 'environment';
  let toastTimer;

  sessionId.textContent = `FN—${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const icons = {
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    audio: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8" />'
  };
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
  }
  function setMode(nextMode) {
    if (recorder?.state === 'recording') return;
    mode = nextMode;
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    icon.innerHTML = icons[mode];
    title.textContent = mode === 'video' ? 'Your camera is ready' : 'Your microphone is ready';
    description.textContent = mode === 'video'
      ? 'Choose a recording type, then press record when you’re set.'
      : 'Find a quiet space, then press record when you’re set.';
    resetRecording();
    stopStream();
  }
  function resetRecording() {
    if (completedRecording) discardRecording(completedRecording.id);
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = null;
    recordingBlob = null;
    completedRecording = null;
    saveButton.hidden = true;
    saveButton.disabled = false;
    saveButton.textContent = 'Save video';
    preview.pause();
    preview.controls = false;
    preview.muted = true;
    preview.removeAttribute('src');
    preview.srcObject = null;
    preview.hidden = true;
    placeholder.hidden = false;
    overlay.hidden = true;
    recordButton.classList.remove('recording');
    recordLabel.textContent = 'Start recording';
    status.classList.remove('recording');
    statusText.textContent = 'READY TO RECORD';
    timer.textContent = '00:00';
    clearInterval(timerInterval);
    clearTimeout(recordingLimitTimeout);
  }
  function stopStream() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  function supportedMimeType() {
    const candidates = mode === 'video'
      ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) || '';
  }
  async function startRecording() {
    if (starting) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify('Recording is not supported in this browser. Try a recent version of Chrome, Edge, or Safari.');
      return;
    }
    starting = true;
    recordButton.disabled = true;
    modeButtons.forEach((button) => { button.disabled = true; });
    try {
      const constraints = mode === 'video'
        ? { audio: true, video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true, video: false };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (mode === 'video') {
        preview.srcObject = stream;
        preview.hidden = false;
        placeholder.hidden = true;
        await preview.play();
      }
      chunks = [];
      const mimeType = supportedMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener('stop', finishRecording, { once: true });
      recorder.start(1000);
      {
        const previousCode = sessionId.textContent;
        let nextCode;
        do {
          nextCode = `FN\u2014${crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()}`;
        } while (nextCode === previousCode);
        sessionId.textContent = nextCode;
      }
      startedAt = Date.now();
      activeSessionId = sessionId.textContent;
      if (mode === 'video') {
        recordingLimitTimeout = setTimeout(() => {
          if (recorder?.state === 'recording') {
            recorder.stop();
            notify('Video stopped automatically after reaching the 1-hour limit. Review it, then choose Save video.');
          }
        }, MAX_VIDEO_DURATION_MS);
      }
      timerInterval = setInterval(() => { timer.textContent = formatDuration(Date.now() - startedAt); }, 250);
      recordButton.classList.add('recording');
      recordLabel.textContent = 'Stop recording';
      status.classList.add('recording');
      statusText.textContent = 'RECORDING IN PROGRESS';
      overlay.hidden = false;
    } catch (error) {
      stopStream();
      const message = error.name === 'NotAllowedError'
        ? 'Camera or microphone access was blocked. Allow access in your browser settings and try again.'
        : error.name === 'NotFoundError'
          ? 'No compatible camera or microphone was found on this device.'
          : 'Could not start recording. Check your device and try again.';
      notify(message);
    } finally {
      starting = false;
      recordButton.disabled = false;
      modeButtons.forEach((button) => { button.disabled = false; });
    }
  }
  function finishRecording() {
    recordButton.disabled = false;
    modeButtons.forEach((button) => { button.disabled = false; });
    clearInterval(timerInterval);
    clearTimeout(recordingLimitTimeout);
    timer.textContent = formatDuration(Date.now() - startedAt);
    const mimeType = recorder?.mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm');
    recordingBlob = new Blob(chunks, { type: mimeType });
    completedRecording = {
      id: crypto.randomUUID(),
      sessionId: activeSessionId,
      mode,
      blob: recordingBlob,
      mimeType,
      startedAt: new Date(startedAt).toISOString(),
      durationMs: mode === 'video' ? Math.min(Date.now() - startedAt, MAX_VIDEO_DURATION_MS) : Date.now() - startedAt,
    };
    saveButton.hidden = false;
    saveButton.textContent = mode === 'video' ? 'Save video' : 'Save audio';
    recordingUrl = URL.createObjectURL(recordingBlob);
    stopStream();
    if (mode === 'video') {
      preview.srcObject = null;
      preview.src = recordingUrl;
      preview.controls = true;
      preview.muted = false;
      preview.hidden = false;
      placeholder.hidden = true;
    } else {
      placeholder.hidden = false;
      title.textContent = 'Recording complete';
      description.textContent = `Audio captured · ${timer.textContent}`;
    }
    overlay.hidden = true;
    recordButton.classList.remove('recording');
    recordLabel.textContent = 'Start recording';
    status.classList.remove('recording');
    statusText.textContent = 'RECORDING READY';
  }
  saveButton.addEventListener('click', async () => {
    if (!completedRecording || saving) return;
    saving = true;
    saveButton.disabled = true;
    recordButton.disabled = true;
    modeButtons.forEach((button) => { button.disabled = true; });
    saveButton.textContent = 'Saving...';
    try {
      await saveRecording({
        ...completedRecording,
        title: $('#caseTitle').value.trim(),
        savedAt: new Date().toISOString(),
      }, (percent) => { saveButton.textContent = percent === 100 ? 'Finishing save...' : `Saving ${percent}%`; });
      saveButton.textContent = 'Saved';
      notify(`Recording saved securely with session ${completedRecording.sessionId}.`);
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = mode === 'video' ? 'Save video' : 'Save audio';
      notify(error.message || 'Could not save the recording. Please try again.');
    } finally {
      saving = false;
      recordButton.disabled = false;
      modeButtons.forEach((button) => { button.disabled = false; });
    }
  });
  recordButton.addEventListener('click', () => {
    if (saving || starting) return;
    if (recorder?.state === 'recording') {
      recordButton.disabled = true;
      modeButtons.forEach((button) => { button.disabled = true; });
      recorder.stop();
    }
    else {
      resetRecording();
      startRecording();
    }
  });
  modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));

}
