"use client";

import { useEffect, useState } from "react";
import { initializeRecorder } from "./recorder";

// prompts shown to the participant before and while they record
const PROMPTS = [
  {
    label: "Prompt One",
    title: "Please reflect who you are with respect to your role at MSU.",
    body: [
      `Please consider both your formal role and your sense of your own identity. You may choose to address this using formal roles or demographic categories or through a more general sense of who you are and what you do. Please note that some experiences at MSU are particular to some roles such that it may be helpful to understand whether you are a student or staff member, focused on academics or not, have a leadership role or not, or play some combination of roles in our community.`,
    ],
  },
  {
    label: "Prompt Two",
    title: "Please reflect on your experience with vulnerability as part of the MSU community.",
    body: [
      `Vulnerability is generally understood as the possibility of experiencing something "bad" but consistency on the concept usually ends there. For example, "feeling vulnerable" is usually a negative experience rooted in threat of harm someone else controls. Alternatively, "being vulnerable" is often an important part of authentically connecting through a "leap of faith" in others. As you reflect, please think both about how you respond to your experiences of vulnerability and the roles others play in your experience of vulnerability. Consider whether there are decisions that others make that tend to make things better or worse for you.`,
    ],
  },
];

// own component with its own state so switching prompts doesn't re-render the recorder
function PromptPanel() {
  const [active, setActive] = useState(0);
  const prompt = PROMPTS[active];

  return (
    <section className="prompt-card" aria-label="Recording prompts">
      <div className="prompt-tabs" role="group" aria-label="Choose a prompt">
        {PROMPTS.map((item, index) => (
          <button
            key={item.label}
            type="button"
            className={"prompt-tab" + (index === active ? " selected" : "")}
            aria-pressed={index === active}
            onClick={() => setActive(index)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <h2 className="prompt-title">{prompt.title}</h2>
      <div className="prompt-body">
        {prompt.body.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  useEffect(() => initializeRecorder(), []);

  return (
    <>
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Fieldnote home"><span className="brand-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M5.64 5.64l12.72 12.72m0-12.72L5.64 18.36"/></svg></span><span>fieldnote<span className="brand-dot">.</span></span></a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-card"><span className="workspace-icon">C</span><span><strong>Criminology Dept.</strong><small>Research workspace</small></span><svg className="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></div>
        <div className="nav-label">RECORD</div>
        <a className="nav-item active" href="#"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="m9 7 1.2-2h3.6L15 7m-3 4v5m-2.5-2.5h5"/></svg>New recording</a>
        <a className="nav-item muted" href="#library" aria-disabled="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v15H5.5A1.5 1.5 0 0 1 4 17.5zM4 7h16M8 4v3m4-3v3"/></svg>Evidence library <span className="soon">SOON</span></a>
        <div className="sidebar-bottom"><div className="privacy-card"><span className="privacy-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v5c0 4.5 2.8 8 7 10 4.2-2 7-5.5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg></span><strong>Private by design</strong><p>Recordings stay on this device until you choose to save them.</p></div><div className="profile"><span className="avatar" id="profileAvatar">NR</span><span><strong id="profileName">Not signed in</strong><small id="profileRole">Private session</small></span></div></div>
      </aside>

      <main className="main">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>New recording</strong></div><div className="top-actions"><span className="secure"><i></i> Secure session</span><button className="auth-button" id="authButton" type="button">Sign in to save</button><button className="help-button" aria-label="Help">?</button></div></header>
        <div className="content">
          <div className="page-heading"><div><div className="eyebrow">FIELD RECORDING</div><h1>Capture a moment.</h1><p className="subtitle">Create a secure audio or video recording for your research.</p></div><div className="session-id"><span>SESSION</span><strong id="sessionId">FN—000000</strong></div></div>
          <PromptPanel />
          <section className="recorder-card" aria-label="Recording controls">
            <div className="recorder-top"><div className="recorder-tabs" role="group" aria-label="Recording type"><button className="mode-button selected" data-mode="video" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg><span>Video</span></button><button className="mode-button" data-mode="audio" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/></svg><span>Audio</span></button></div><div className="ready-indicator" id="status"><i></i><span>READY TO RECORD</span></div></div>
            <div className="stage" id="stage"><video id="livePreview" autoPlay muted playsInline hidden></video><div className="stage-placeholder" id="stagePlaceholder"><div className="stage-art"><span className="art-ring ring-one"></span><span className="art-ring ring-two"></span><span className="art-core"><svg id="stageIcon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg></span><span className="art-spark spark-a"></span><span className="art-spark spark-b"></span></div><strong id="stageTitle">Your camera is ready</strong><p id="stageDescription">Choose a recording type, then press record when you’re set.</p></div><div className="recording-overlay" id="recordingOverlay" hidden><span className="live-dot"></span><span>RECORDING</span><time id="timer">00:00</time></div><div className="stage-corner">FIELDNOTE&nbsp; / &nbsp;RECORDER 01</div></div>
          <div className="recorder-controls"><div className="control-side"><button className="icon-control" id="flipButton" aria-label="Switch camera" title="Switch camera"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3"/></svg></button><span id="inputLabel">Camera &amp; microphone</span></div><div className="record-actions"><button className="record-button" id="recordButton"><span className="record-button-inner" id="recordGlyph"></span><span id="recordLabel">Start recording</span></button><button className="download-button" id="downloadButton" type="button" hidden>Download copy</button></div><div className="control-side right"><button className="icon-control" id="soundButton" aria-label="Toggle microphone monitor" title="Microphone status"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-8v4a4 4 0 0 0 8 0V7m-4 12v2m-4 0h8"/></svg></button><span id="qualityLabel">HD video</span></div></div>
          </section>
          <div className="below-grid"><section className="details-card"><div className="section-title"><div><span className="step-number">01</span><h2>Session details</h2></div><span className="optional">OPTIONAL</span></div><label htmlFor="caseTitle">Recording title</label><div className="input-wrap"><input id="caseTitle" type="text" maxLength="80" placeholder="e.g. Community safety interview" /><span className="input-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h13"/></svg></span></div><div className="field-hint">Add a title to help identify this recording later.</div></section><section className="checklist-card"><div className="section-title"><div><span className="step-number">02</span><h2>Before you begin</h2></div></div><ul><li><span className="checkmark">✓</span><span>Find a quiet, well-lit space</span></li><li><span className="checkmark">✓</span><span>Confirm you have consent to record</span></li><li><span className="checkmark">✓</span><span>Keep this tab open while recording</span></li></ul></section></div>
          <footer className="page-footer"><span><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/></svg>Recordings upload to private department storage when saved.</span><a href="#privacy">Privacy &amp; data handling <span>↗</span></a></footer>
        </div>
      </main>
    </div>
    <div className="toast" id="toast" role="status" aria-live="polite"></div>
    <dialog className="auth-dialog" id="authDialog">
      <form id="authForm" className="auth-form">
        <button className="dialog-close" id="authClose" type="button" aria-label="Close">×</button>
        <div className="eyebrow">RESEARCHER ACCESS</div>
        <h2>Sign in to save</h2>
        <p>We’ll email you a secure sign-in link. Only department-approved accounts can access recordings.</p>
        <label htmlFor="authEmail">Department email</label>
        <input id="authEmail" type="email" required autoComplete="email" placeholder="you@university.edu" />
        <button className="record-button auth-submit" type="submit" id="authSubmit">Email me a sign-in link</button>
        <div className="field-hint" id="authMessage" aria-live="polite"></div>
      </form>
    </dialog>
    </>
  );
}
