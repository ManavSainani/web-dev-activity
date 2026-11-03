import { getSupabaseBrowserClient } from "../lib/supabase-browser";

let initialized = false;

export function initializeRecorder() {
  if (initialized) return;
  initialized = true;

  const $ = (selector) => document.querySelector(selector);
  const shell = $(".shell");
  const accessGate = $("#accessGate");
  const accessForm = $("#accessForm");
  const accessToken = $("#accessToken");
  const accessSubmit = $("#accessSubmit");
  const accessMessage = $("#accessMessage");
  const accessButton = $("#accessButton");
  const modeButtons = [...document.querySelectorAll(".mode-button")];
  const recordButton = $("#recordButton");
  const downloadButton = $("#downloadButton");
  const recordLabel = $("#recordLabel");
  const status = $("#status");
  const statusText = status.querySelector("span");
  const preview = $("#livePreview");
  const placeholder = $("#stagePlaceholder");
  const title = $("#stageTitle");
  const description = $("#stageDescription");
  const icon = $("#stageIcon");
  const overlay = $("#recordingOverlay");
  const timer = $("#timer");
  const toast = $("#toast");
  const sessionId = $("#sessionId");
  const supabase = getSupabaseBrowserClient();
  let mode = "video";
  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordingBlob = null;
  let recordingUrl = null;
  let timerInterval = null;
  let startedAt = 0;
  let recordingDurationSeconds = 0;
  let facingMode = "environment";
  let toastTimer;
  let accessGranted = false;
  let saving = false;
  let accessExpiryTimer;
  let accessCheckComplete = false;

  sessionId.textContent = `FN—${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
  }

  function setAccess(granted, expiresAt = null) {
    clearTimeout(accessExpiryTimer);
    accessGranted = granted;
    accessGate.hidden = granted;
    shell.inert = !granted;
    accessButton.textContent = granted ? "End access" : "Access key required";
    $("#profileName").textContent = granted ? "Authorized session" : "Not signed in";
    $("#profileRole").textContent = granted ? "Recording access active" : "Private session";
    $("#profileAvatar").textContent = granted ? "OK" : "NR";
    if (recordingBlob && !saving) recordLabel.textContent = granted ? "Save to Supabase" : "Access expired";
    statusText.textContent = granted ? "READY TO RECORD" : "ACCESS KEY REQUIRED";
    if (granted && expiresAt) {
      accessExpiryTimer = setTimeout(() => {
        if (recorder?.state === "recording") recorder.stop();
        setAccess(false);
        notify("Your recording session expired. Download the recording or enter another key to save.");
      }, Math.max(0, expiresAt - Date.now()));
    }
  }

  function focusAccessGate(message = "") {
    setAccess(false);
    accessMessage.textContent = message;
    accessToken.focus();
  }

  fetch("/api/access/session")
    .then((response) => response.json())
    .then(({ active, expiresAt }) => {
      if (accessCheckComplete) return;
      accessCheckComplete = true;
      setAccess(Boolean(active), expiresAt);
    })
    .catch(() => {
      if (accessCheckComplete) return;
      accessCheckComplete = true;
      setAccess(false);
    });

  const icons = {
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    audio: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8" />',
  };

  function resetRecording() {
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    recordingUrl = null;
    recordingBlob = null;
    preview.pause();
    preview.removeAttribute("src");
    preview.srcObject = null;
    preview.controls = false;
    preview.muted = true;
    preview.hidden = true;
    placeholder.hidden = false;
    overlay.hidden = true;
    recordButton.classList.remove("recording");
    recordButton.disabled = false;
    recordLabel.textContent = "Start recording";
    downloadButton.hidden = true;
    status.classList.remove("recording");
    statusText.textContent = accessGranted ? "READY TO RECORD" : "ACCESS KEY REQUIRED";
    timer.textContent = "00:00";
    clearInterval(timerInterval);
  }

  function stopStream() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  function setMode(nextMode) {
    if (recorder?.state === "recording") return;
    mode = nextMode;
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    $("#qualityLabel").textContent = mode === "video" ? "HD video" : "Voice recording";
    $("#inputLabel").textContent = mode === "video" ? "Camera & microphone" : "Microphone";
    icon.innerHTML = icons[mode];
    title.textContent = mode === "video" ? "Your camera is ready" : "Your microphone is ready";
    description.textContent = mode === "video"
      ? "Choose a recording type, then press record when you’re set."
      : "Find a quiet space, then press record when you’re set.";
    resetRecording();
    stopStream();
  }

  function formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function supportedMimeType() {
    const candidates = mode === "video"
      ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
      : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    return candidates.find((type) => window.MediaRecorder?.isTypeSupported(type)) || "";
  }

  async function startRecording() {
    if (!accessGranted) {
      focusAccessGate("Enter a valid one-time key before recording.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      notify("Recording is not supported in this browser. Try a recent version of Chrome, Edge, or Safari.");
      return;
    }
    try {
      const constraints = mode === "video"
        ? { audio: true, video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { audio: true, video: false };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!accessGranted) {
        stopStream();
        return;
      }
      if (mode === "video") {
        preview.srcObject = stream;
        preview.hidden = false;
        placeholder.hidden = true;
        await preview.play();
      }
      chunks = [];
      const mimeType = supportedMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("stop", finishRecording, { once: true });
      recorder.start(1000);
      startedAt = Date.now();
      timerInterval = setInterval(() => { timer.textContent = formatDuration(Date.now() - startedAt); }, 250);
      recordButton.classList.add("recording");
      recordLabel.textContent = "Stop recording";
      status.classList.add("recording");
      statusText.textContent = "RECORDING IN PROGRESS";
      overlay.hidden = false;
    } catch (error) {
      stopStream();
      const message = error.name === "NotAllowedError"
        ? "Camera or microphone access was blocked. Allow access in your browser settings and try again."
        : error.name === "NotFoundError"
          ? "No compatible camera or microphone was found on this device."
          : "Could not start recording. Check your device and try again.";
      notify(message);
    }
  }

  function finishRecording() {
    clearInterval(timerInterval);
    const elapsedMilliseconds = Date.now() - startedAt;
    recordingDurationSeconds = Math.floor(elapsedMilliseconds / 1000);
    timer.textContent = formatDuration(elapsedMilliseconds);
    const mimeType = recorder?.mimeType || (mode === "video" ? "video/webm" : "audio/webm");
    recordingBlob = new Blob(chunks, { type: mimeType });
    recordingUrl = URL.createObjectURL(recordingBlob);
    stopStream();
    if (mode === "video") {
      preview.srcObject = null;
      preview.src = recordingUrl;
      preview.controls = true;
      preview.muted = false;
      preview.hidden = false;
      placeholder.hidden = true;
    } else {
      placeholder.hidden = false;
      title.textContent = "Recording complete";
      description.textContent = `Audio captured · ${timer.textContent}`;
    }
    overlay.hidden = true;
    recordButton.classList.remove("recording");
    recordLabel.textContent = accessGranted ? "Save to Supabase" : "Access expired";
    downloadButton.hidden = false;
    status.classList.remove("recording");
    statusText.textContent = accessGranted ? "RECORDING READY" : "ACCESS EXPIRED";
  }

  function downloadRecording() {
    if (!recordingBlob || !recordingUrl) return;
    const extension = recordingBlob.type.includes("mp4") ? "mp4" : "webm";
    const caseName = $("#caseTitle").value.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
    const filename = `${caseName || "fieldnote"}-${sessionId.textContent.replace("FN—", "").toLowerCase()}.${extension}`;
    const link = document.createElement("a");
    link.href = recordingUrl;
    link.download = filename;
    link.click();
    notify("Recording downloaded to this device.");
  }

  async function saveRecording() {
    if (!accessGranted) {
      focusAccessGate("Your recording session expired. Enter a new one-time key to save it.");
      return;
    }
    if (!supabase) {
      notify("Supabase browser settings are missing. Set the project URL and publishable key.");
      return;
    }
    if (!recordingBlob || saving) return;

    saving = true;
    recordButton.disabled = true;
    recordLabel.textContent = "Preparing secure upload…";
    statusText.textContent = "SAVING TO SUPABASE";
    const contentType = recordingBlob.type.split(";")[0] || (mode === "video" ? "video/webm" : "audio/webm");
    const caseName = $("#caseTitle").value.trim();
    try {
      const prepareResponse = await fetch("/api/recordings/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          contentType,
          title: caseName,
          durationSeconds: recordingDurationSeconds,
          fileSizeBytes: recordingBlob.size,
        }),
      });
      const prepared = await prepareResponse.json();
      if (!prepareResponse.ok) throw new Error(prepared.error || "Could not prepare secure upload.");

      recordLabel.textContent = "Uploading recording…";
      const { error: uploadError } = await supabase.storage
        .from("recordings")
        .uploadToSignedUrl(prepared.path, prepared.uploadToken, recordingBlob, {
          cacheControl: "0",
          contentType,
        });
      if (uploadError) throw uploadError;

      const completeResponse = await fetch("/api/recordings/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prepared.id }),
      });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error || "Could not finalize the recording.");

      recordLabel.textContent = "Saved to Supabase";
      statusText.textContent = "SAVED TO PRIVATE STORAGE";
      notify("Recording saved to private department storage.");
    } catch (error) {
      console.error("Recording upload failed:", error);
      recordButton.disabled = false;
      recordLabel.textContent = "Retry save";
      statusText.textContent = "SAVE FAILED";
      notify(error.message || "Could not save the recording. Check your storage configuration and try again.");
    } finally {
      saving = false;
    }
  }

  accessForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    accessSubmit.disabled = true;
    accessMessage.textContent = "Checking key…";
    try {
      const response = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken.value.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That key is invalid, expired, or already used.");
      accessCheckComplete = true;
      setAccess(true, result.expiresAt);
      accessToken.value = "";
      accessMessage.textContent = "";
      statusText.textContent = "ACCESS GRANTED";
      notify("Recording access unlocked for 30 minutes.");
    } catch (error) {
      accessMessage.textContent = error.message || "Could not verify the key. Try again.";
    } finally {
      accessSubmit.disabled = false;
    }
  });

  accessButton.addEventListener("click", async () => {
    if (!accessGranted) {
      focusAccessGate();
      return;
    }
    if (recorder?.state === "recording") recorder.stop();
    await fetch("/api/access/end", { method: "POST" });
    setAccess(false);
    notify("Recording access ended.");
  });

  recordButton.addEventListener("click", () => {
    if (recorder?.state === "recording") recorder.stop();
    else if (recordingBlob) saveRecording();
    else startRecording();
  });
  downloadButton.addEventListener("click", downloadRecording);
  modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
  $("#flipButton").addEventListener("click", () => {
    if (mode !== "video" || recorder?.state === "recording") return;
    facingMode = facingMode === "environment" ? "user" : "environment";
    notify(facingMode === "user" ? "Front camera selected for your next recording." : "Rear camera selected for your next recording.");
  });
  $("#soundButton").addEventListener("click", () => notify("Microphone access is requested when you start recording."));
}
