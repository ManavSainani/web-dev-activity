let initialized = false;

export function initializeRecorder() {
  if (initialized) return;
  initialized = true;
  const $ = (selector) => document.querySelector(selector);
  const modeButtons = [...document.querySelectorAll('.mode-button')];
  const recordButton = $('#recordButton');
  const recordLabel = $('#recordLabel');
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
  let timerInterval = null;
  let startedAt = 0;
  let facingMode = 'environment';
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
    $('#qualityLabel').textContent = mode === 'video' ? 'HD video' : 'Voice recording';
    $('#inputLabel').textContent = mode === 'video' ? 'Camera & microphone' : 'Microphone';
    icon.innerHTML = icons[mode];
    title.textContent = mode === 'video' ? 'Your camera is ready' : 'Your microphone is ready';
    description.textContent = mode === 'video'
      ? 'Choose a recording type, then press record when you’re set.'
      : 'Find a quiet space, then press record when you’re set.';
    resetRecording();
    stopStream();
  }
  function resetRecording() {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = null;
    recordingBlob = null;
    preview.pause();
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
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify('Recording is not supported in this browser. Try a recent version of Chrome, Edge, or Safari.');
      return;
    }
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
      startedAt = Date.now();
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
    }
  }
  function finishRecording() {
    clearInterval(timerInterval);
    timer.textContent = formatDuration(Date.now() - startedAt);
    const mimeType = recorder?.mimeType || (mode === 'video' ? 'video/webm' : 'audio/webm');
    recordingBlob = new Blob(chunks, { type: mimeType });
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
    recordLabel.textContent = 'Download recording';
    status.classList.remove('recording');
    statusText.textContent = 'RECORDING READY';
  }
  function downloadRecording() {
    if (!recordingBlob || !recordingUrl) return;
    const extension = recordingBlob.type.includes('mp4') ? 'mp4' : (mode === 'audio' ? 'webm' : 'webm');
    const caseName = $('#caseTitle').value.trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    const filename = `${caseName || 'fieldnote'}-${sessionId.textContent.replace('FN—', '').toLowerCase()}.${extension}`;
    const link = document.createElement('a');
    link.href = recordingUrl;
    link.download = filename;
    link.click();
    notify('Recording downloaded to this device.');
  }
  recordButton.addEventListener('click', () => {
    if (recorder?.state === 'recording') recorder.stop();
    else if (recordingBlob) downloadRecording();
    else startRecording();
  });
  modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('#flipButton').addEventListener('click', async () => {
    if (mode !== 'video' || recorder?.state === 'recording') return;
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    if (stream) {
      stopStream();
      await startRecording();
      if (recorder?.state === 'recording') recorder.stop();
      notify(facingMode === 'user' ? 'Front camera selected.' : 'Rear camera selected.');
    } else {
      notify(facingMode === 'user' ? 'Front camera selected for your next recording.' : 'Rear camera selected for your next recording.');
    }
  });
  $('#soundButton').addEventListener('click', () => notify('Microphone access is requested when you start recording.'));
}
