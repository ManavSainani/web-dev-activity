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
  if (active) return <p className="access-status" role="status">One-time key accepted. Recording is unlocked for this session.</p>;
  return <form className="access-form" onSubmit={verify}>
    <label htmlFor="accessKey">Researcher access key</label>
    <div><input id="accessKey" type="password" autoComplete="off" inputMode="text" maxLength={64} minLength={64} pattern="[a-fA-F0-9]{64}" aria-describedby="accessKeyHelp" required value={key} onChange={(event) => setKey(event.target.value)} disabled={busy} placeholder="Paste your one-time key" /><button className="save-button" disabled={busy}>{busy ? 'Verifying...' : 'Unlock recording'}</button></div>
    <small id="accessKeyHelp">This key works once. Your recording session expires after four hours.</small>
    <p role="status">{message}</p>
  </form>;
}
