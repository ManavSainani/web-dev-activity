"use client";
import { useEffect, useState } from 'react';

export default function AccessKey() {
  const [key, setKey] = useState('');
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Enter your researcher access key to enable saving.');
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const response = await fetch('/api/access/session', { cache: 'no-store' });
        const session = await response.json();
        if (!cancelled) setActive(Boolean(session.active));
      } catch { /* Leave key entry available if offline. */ }
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
      setKey('');
    } catch (error) { setMessage(error.message || 'Could not verify access. Please retry.'); }
    finally { setBusy(false); }
  }
  if (active) return <p className="access-status" role="status">Researcher access verified. Recordings can be saved securely.</p>;
  return <form className="access-form" onSubmit={verify}>
    <label htmlFor="accessKey">Researcher access key</label>
    <div><input id="accessKey" type="password" autoComplete="off" required value={key} onChange={(event) => setKey(event.target.value)} disabled={busy} /><button className="save-button" disabled={busy}>{busy ? 'Verifying...' : 'Verify key'}</button></div>
    <p role="status">{message}</p>
  </form>;
}
