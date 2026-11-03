import { getSupabaseBrowserClient } from "../lib/supabase-browser";

let initialized = false;

export function initializeRecorder() {
  if (initialized) return;
  initialized = true;
  const $ = (selector) => document.querySelector(selector);
  const modeButtons = [...document.querySelectorAll('.mode-button')];
  const recordButton = $('#recordButton');
  const downloadButton = $('#downloadButton');
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
  const authButton = $('#authButton');
  const authDialog = $('#authDialog');
  const authForm = $('#authForm');
  const authEmail = $('#authEmail');
  const authSubmit = $('#authSubmit');
  const authMessage = $('#authMessage');
  const supabase = getSupabaseBrowserClient();
  let mode = 'video';
  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordingBlob = null;
  let recordingUrl = null;
  let timerInterval = null;
  let startedAt = 0;
  let recordingDurationSeconds = 0;
  let facingMode = 'environment';
  let toastTimer;
  let currentUser = null;
  let saving = false;

  sessionId.textContent = `FN—${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  if (supabase) {
    supabase.auth.onAuthStateChange((_event, session) => {
      currentUser = session?.user ?? null;
      authButton.textContent = currentUser ? 'Sign out' : 'Sign in to save';
      authButton.title = currentUser?.email || '';
      $('#profileName').textContent = currentUser?.email || 'Not signed in';
      $('#profileRole').textContent = currentUser ? 'Authenticated researcher' : 'Private session';
      $('#profileAvatar').textContent = currentUser?.email?.slice(0, 2).toUpperCase() || 'NR';
      if (recordingBlob && !saving) recordLabel.textContent = currentUser ? 'Save to Supabase' : 'Sign in to save';
    });
  } else {
    authButton.textContent = 'Storage not configured';
    authButton.disabled = true;
    authButton.title = 'Add the Supabase environment variables to configure storage.';
  }
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
    recordButton.disabled = false;
    recordLabel.textContent = 'Start recording';
    downloadButton.hidden = true;
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
    const elapsedMilliseconds = Date.now() - startedAt;
    recordingDurationSeconds = Math.floor(elapsedMilliseconds / 1000);
    timer.textContent = formatDuration(elapsedMilliseconds);
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
    recordLabel.textContent = currentUser ? 'Save to Supabase' : 'Sign in to save';
    downloadButton.hidden = false;
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
  async function saveRecording() {
    if (!supabase) {
      notify('Storage is not configured yet. Add the Supabase URL and publishable key to the environment.');
      return;
    }
    if (!currentUser) {
      authDialog.showModal();
      authEmail.focus();
      authMessage.textContent = 'Sign in to save this recording securely.';
      return;
    }
    if (!recordingBlob || saving) return;

    saving = true;
    recordButton.disabled = true;
    recordLabel.textContent = 'Saving…';
    statusText.textContent = 'SAVING TO SUPABASE';
    const contentType = recordingBlob.type.split(';')[0] || (mode === 'video' ? 'video/webm' : 'audio/webm');
    const extension = contentType.includes('mp4') ? 'mp4' : 'webm';
    const objectPath = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
    const recordingTitle = $('#caseTitle').value.trim() || `${mode === 'video' ? 'Video' : 'Audio'} ${sessionId.textContent}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('recordings')
        .upload(objectPath, recordingBlob, {
          cacheControl: '0',
          contentType,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { error: metadataError } = await supabase.from('recordings').insert({
        owner_id: currentUser.id,
        title: recordingTitle,
        mode,
        object_path: objectPath,
        duration_seconds: recordingDurationSeconds,
        content_type: contentType,
      });
      if (metadataError) {
        console.error('Recording details insert failed after file upload:', objectPath, metadataError);
        throw new Error('The file uploaded, but its record could not be saved. Contact your administrator before retrying.');
      }
      recordLabel.textContent = 'Saved to Supabase';
      statusText.textContent = 'SAVED TO PRIVATE STORAGE';
      notify('Recording saved to your private Supabase storage.');
    } catch (error) {
      console.error('Recording upload failed:', error);
      recordButton.disabled = false;
      recordLabel.textContent = 'Retry save';
      statusText.textContent = 'SAVE FAILED';
      notify(error.message || 'Could not save the recording. Check your storage configuration and try again.');
    } finally {
      saving = false;
    }
  }
  recordButton.addEventListener('click', () => {
    if (recorder?.state === 'recording') recorder.stop();
    else if (recordingBlob) saveRecording();
    else startRecording();
  });
  downloadButton.addEventListener('click', downloadRecording);
  authButton.addEventListener('click', async () => {
    if (currentUser) {
      const { error } = await supabase.auth.signOut();
      if (error) notify(error.message);
      else notify('You are signed out.');
      return;
    }
    authMessage.textContent = '';
    authDialog.showModal();
    authEmail.focus();
  });
  $('#authClose').addEventListener('click', () => authDialog.close());
  authDialog.addEventListener('click', (event) => {
    if (event.target === authDialog) authDialog.close();
  });
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    authSubmit.disabled = true;
    authMessage.textContent = 'Sending your sign-in link…';
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmail.value.trim(),
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: false,
        },
      });
      authMessage.textContent = error
        ? error.message
        : 'Check your department email for a secure sign-in link.';
    } catch (error) {
      authMessage.textContent = error.message || 'Could not send the sign-in email. Try again.';
    } finally {
      authSubmit.disabled = false;
    }
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
