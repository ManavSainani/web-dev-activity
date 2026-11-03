"use client";
import { useEffect, useState } from 'react';

export default function AccessKey() {
  const [key, setKey] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Enter your one-time key to unlock recording and secure saving.');
  useEffect(() => {
    let cancelled = false;
    const updateAccess = (value, expiresAt = null) => {
      if (cancelled) return;
      setActive(Boolean(value));
      window.dispatchEvent(new CustomEvent('recording-access-change', { detail: { active: Boolean(value), expiresAt } }));
    };
    async function check() {
      try {
        const response = await fetch('/api/access/session', { cache: 'no-store' });
        const session = await response.json();
        updateAccess(session.active, session.expiresAt);
      } catch { updateAccess(false); }
    }
    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);
  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/access/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: key.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setActive(true);
      window.dispatchEvent(new CustomEvent('recording-access-change', { detail: { active: true, expiresAt: result.expiresAt } }));
      setKey('');
    } catch (error) { setMessage(error.message || 'Could not verify access. Please retry.'); }
    finally { setBusy(false); }
  }
  if (active) return null;
  return <div className="access-overlay" role="dialog" aria-modal="true" aria-labelledby="accessKeyTitle">
    <form className="access-form" onSubmit={verify}>
      <div className="access-form-card">
        <div className="eyebrow">RESEARCHER ACCESS</div>
        <h2 id="accessKeyTitle">Unlock the recorder</h2>
        <p className="access-intro">Enter your one-time access key to enable audio and video recording.</p>
        <label htmlFor="accessKey">One-time access key</label>
        <div className="access-input-row">
          <input id="accessKey" type="password" autoComplete="off" inputMode="text" maxLength={64} minLength={64} pattern="[a-fA-F0-9]{64}" aria-describedby="accessKeyHelp" required value={key} onChange={(event) => setKey(event.target.value)} disabled={busy} placeholder="Paste your access key" />
          <button className="save-button" disabled={busy}>{busy ? 'Checking...' : 'Unlock'}</button>
        </div>
        <small id="accessKeyHelp">Keys work once. Recording access lasts four hours.</small>
        <p className="access-message" role="status">{message}</p>
      </div>
    </form>
  </div>;
}
